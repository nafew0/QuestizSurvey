import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from surveys.models import Answer, Choice, Collector, Page, Question, Survey, SurveyResponse

User = get_user_model()


class AnalyticsApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="analytics-owner",
            email="analytics-owner@example.com",
            password="TestPass123!",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.survey = Survey.objects.create(
            user=self.user,
            title="Analytics Survey",
            status=Survey.Status.ACTIVE,
        )
        self.page = Page.objects.create(survey=self.survey, title="Page 1", order=1)
        self.web_collector = Collector.objects.create(
            survey=self.survey,
            type=Collector.CollectorType.WEB_LINK,
            name="Web",
            status=Collector.Status.OPEN,
        )
        self.email_collector = Collector.objects.create(
            survey=self.survey,
            type=Collector.CollectorType.EMAIL,
            name="Email",
            status=Collector.Status.OPEN,
        )

        self.choice_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.MULTIPLE_CHOICE_SINGLE,
            text="How satisfied are you?",
            order=1,
        )
        self.choice_great = Choice.objects.create(
            question=self.choice_question,
            text="Great",
            order=1,
        )
        self.choice_okay = Choice.objects.create(
            question=self.choice_question,
            text="Okay",
            order=2,
        )

        self.nps_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.NPS,
            text="How likely are you to recommend us?",
            order=2,
            settings={"min_value": 0, "max_value": 10},
        )
        self.text_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.SHORT_TEXT,
            text="Tell us why",
            order=3,
        )
        self.matrix_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.MATRIX,
            text="Rate each area",
            order=4,
            settings={"rows": ["Speed", "Support"], "columns": ["1", "2", "3"]},
        )
        self.constant_sum_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.CONSTANT_SUM,
            text="Allocate 100 points",
            order=5,
            settings={"target_sum": 100},
        )
        self.price_choice = Choice.objects.create(
            question=self.constant_sum_question,
            text="Price",
            order=1,
        )
        self.quality_choice = Choice.objects.create(
            question=self.constant_sum_question,
            text="Quality",
            order=2,
        )

        base_time = timezone.now() - timedelta(days=5)
        self.response_1 = self._create_response(
            status_value=SurveyResponse.Status.COMPLETED,
            collector=self.web_collector,
            started_at=base_time,
            completed_at=base_time + timedelta(minutes=2),
            duration_seconds=120,
            choice_id=self.choice_great.id,
            nps_value=10,
            text_value="Fast delivery and excellent support",
            matrix_data={"Speed": "3", "Support": "2"},
            constant_sum_data={
                str(self.price_choice.id): 40,
                str(self.quality_choice.id): 60,
            },
        )
        self.response_2 = self._create_response(
            status_value=SurveyResponse.Status.COMPLETED,
            collector=self.email_collector,
            started_at=base_time + timedelta(days=1),
            completed_at=base_time + timedelta(days=1, minutes=3),
            duration_seconds=180,
            choice_id=self.choice_okay.id,
            nps_value=8,
            text_value="Delivery was okay",
            matrix_data={"Speed": "2", "Support": "2"},
            constant_sum_data={
                str(self.price_choice.id): 55,
                str(self.quality_choice.id): 45,
            },
        )
        self.response_3 = self._create_response(
            status_value=SurveyResponse.Status.IN_PROGRESS,
            collector=self.email_collector,
            started_at=base_time + timedelta(days=2),
            completed_at=None,
            duration_seconds=None,
            choice_id=self.choice_great.id,
            nps_value=4,
            text_value="Slow delivery",
            matrix_data={"Speed": "1", "Support": "1"},
            constant_sum_data={
                str(self.price_choice.id): 70,
                str(self.quality_choice.id): 30,
            },
        )

    def _create_response(
        self,
        *,
        status_value,
        collector,
        started_at,
        completed_at,
        duration_seconds,
        choice_id,
        nps_value,
        text_value,
        matrix_data,
        constant_sum_data,
    ):
        response = SurveyResponse.objects.create(
            survey=self.survey,
            collector=collector,
            status=status_value,
            current_page=self.page,
            respondent_email=f"{collector.name.lower()}-{SurveyResponse.objects.count()}@example.com",
        )
        SurveyResponse.objects.filter(id=response.id).update(
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration_seconds,
        )
        response.refresh_from_db()

        Answer.objects.create(
            response=response,
            question=self.choice_question,
            choice_ids=[str(choice_id)],
        )
        Answer.objects.create(
            response=response,
            question=self.nps_question,
            numeric_value=nps_value,
        )
        Answer.objects.create(
            response=response,
            question=self.text_question,
            text_value=text_value,
        )
        Answer.objects.create(
            response=response,
            question=self.matrix_question,
            matrix_data=matrix_data,
        )
        Answer.objects.create(
            response=response,
            question=self.constant_sum_question,
            constant_sum_data=constant_sum_data,
        )
        return response

    def test_summary_endpoint_returns_core_metrics(self):
        response = self.client.get(
            f"/api/surveys/{self.survey.id}/analytics/summary/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_responses"], 3)
        self.assertEqual(response.data["completed_count"], 2)
        self.assertEqual(response.data["in_progress_count"], 1)
        self.assertEqual(response.data["completion_rate"], 66.67)
        self.assertEqual(response.data["average_duration_seconds"], 150.0)
        self.assertEqual(len(response.data["responses_over_time"]), 2)

    def test_question_analytics_endpoint_supports_multiple_question_types(self):
        categorical = self.client.get(
            f"/api/surveys/{self.survey.id}/analytics/questions/{self.choice_question.id}/"
        )
        numeric = self.client.get(
            f"/api/surveys/{self.survey.id}/analytics/questions/{self.nps_question.id}/"
        )
        text = self.client.get(
            f"/api/surveys/{self.survey.id}/analytics/questions/{self.text_question.id}/"
        )
        matrix = self.client.get(
            f"/api/surveys/{self.survey.id}/analytics/questions/{self.matrix_question.id}/"
        )
        constant_sum = self.client.get(
            f"/api/surveys/{self.survey.id}/analytics/questions/{self.constant_sum_question.id}/"
        )

        self.assertEqual(categorical.status_code, status.HTTP_200_OK)
        self.assertEqual(categorical.data["type"], "categorical")
        self.assertEqual(categorical.data["choices"][0]["count"], 2)

        self.assertEqual(numeric.data["type"], "numeric")
        self.assertEqual(numeric.data["nps_score"], 0)
        self.assertEqual(numeric.data["nps_segments"]["promoters"], 1)

        self.assertEqual(text.data["type"], "text")
        self.assertEqual(text.data["total_responses"], 3)
        self.assertEqual(text.data["word_frequencies"][0]["word"], "delivery")

        self.assertEqual(matrix.data["type"], "matrix")
        self.assertEqual(matrix.data["rows"][0]["columns"][2]["count"], 1)
        self.assertEqual(matrix.data["row_averages"][0]["avg_score"], 2.0)

        self.assertEqual(constant_sum.data["type"], "constant_sum")
        self.assertEqual(constant_sum.data["items"][0]["total_value"], 165.0)

    def test_all_questions_endpoint_returns_each_non_structural_question(self):
        response = self.client.get(
            f"/api/surveys/{self.survey.id}/analytics/questions/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)

    def test_crosstab_endpoint_returns_matrix_and_chi_square(self):
        response = self.client.get(
            f"/api/surveys/{self.survey.id}/analytics/crosstab/",
            {"row": str(self.choice_question.id), "col": str(self.nps_question.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["grand_total"], 3)
        self.assertEqual(response.data["matrix"][0]["row_total"], 2)
        self.assertIn("chi_square", response.data)
        self.assertIn("p_value", response.data["chi_square"])

    def test_filters_json_applies_to_analytics(self):
        filters = {
            "status": "completed",
            "collector_id": str(self.email_collector.id),
            "answer_filters": [
                {
                    "question_id": str(self.choice_question.id),
                    "choice_id": str(self.choice_okay.id),
                }
            ],
        }

        response = self.client.get(
            f"/api/surveys/{self.survey.id}/analytics/summary/",
            {"filters": json.dumps(filters)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_responses"], 1)
        self.assertEqual(response.data["completed_count"], 1)

    @patch(
        "surveys.services.analytics.AnalyticsTextInsightsService.build_insights",
        return_value={
            "available": True,
            "source": "openai",
            "headline": "Delivery strength stands out.",
            "bullets": ["Completed responses cluster around stronger satisfaction."],
        },
    )
    def test_include_insights_adds_chatgpt_summary(self, _mocked_build_insights):
        response = self.client.get(
            f"/api/surveys/{self.survey.id}/analytics/summary/",
            {"include_insights": "true"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["insights"]["available"])
        self.assertEqual(
            response.data["insights"]["headline"],
            "Delivery strength stands out.",
        )

    def test_response_list_detail_delete_and_bulk_delete(self):
        list_response = self.client.get(
            f"/api/surveys/{self.survey.id}/responses/",
            {
                "q": str(self.choice_question.id),
                "answer": str(self.choice_great.id),
                "ordering": "duration_seconds",
            },
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 2)
        self.assertEqual(
            len(list_response.data["results"][0]["answer_summaries"]),
            3,
        )

        detail_response = self.client.get(
            f"/api/surveys/{self.survey.id}/responses/{self.response_1.id}/"
        )
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            detail_response.data["answers"][0]["question_text"],
            "How satisfied are you?",
        )
        self.assertEqual(detail_response.data["answers"][0]["choice_texts"], ["Great"])

        delete_response = self.client.delete(
            f"/api/surveys/{self.survey.id}/responses/{self.response_3.id}/"
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(SurveyResponse.objects.filter(id=self.response_3.id).exists())

        bulk_delete_response = self.client.post(
            f"/api/surveys/{self.survey.id}/responses/bulk-delete/",
            {"ids": [str(self.response_1.id), str(self.response_2.id)]},
            format="json",
        )
        self.assertEqual(bulk_delete_response.status_code, status.HTTP_200_OK)
        self.assertEqual(bulk_delete_response.data["deleted_count"], 2)
        self.assertEqual(self.survey.responses.count(), 0)

    def test_saved_report_crud(self):
        create_response = self.client.post(
            f"/api/surveys/{self.survey.id}/reports/",
            {
                "name": "Weekly overview",
                "config": {
                    "filters": {"status": "completed"},
                    "card_preferences": {
                        str(self.choice_question.id): {
                            "chartType": "pie",
                        }
                    },
                },
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        report_id = create_response.data["id"]

        list_response = self.client.get(f"/api/surveys/{self.survey.id}/reports/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)

        update_response = self.client.patch(
            f"/api/surveys/{self.survey.id}/reports/{report_id}/",
            {"name": "Updated overview"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["name"], "Updated overview")

        delete_response = self.client.delete(
            f"/api/surveys/{self.survey.id}/reports/{report_id}/"
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
