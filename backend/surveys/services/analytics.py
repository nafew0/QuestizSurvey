import math
import os
import re
from collections import Counter, defaultdict
from statistics import StatisticsError, mean, median, mode, pstdev
from urllib.parse import urlparse

from django.db.models import Avg, Count, Prefetch, Q
from django.db.models.functions import TruncDate

from surveys.models import Answer, Choice, Question, Survey, SurveyResponse
from surveys.services.ai_insights import AnalyticsTextInsightsService
from surveys.services.filters import ResponseFilterService


STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "how",
    "i",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "our",
    "that",
    "the",
    "their",
    "this",
    "to",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "which",
    "who",
    "will",
    "with",
    "you",
    "your",
}

CATEGORICAL_TYPES = {
    Question.QuestionType.MULTIPLE_CHOICE_SINGLE,
    Question.QuestionType.MULTIPLE_CHOICE_MULTI,
    Question.QuestionType.DROPDOWN,
    Question.QuestionType.YES_NO,
    Question.QuestionType.IMAGE_CHOICE,
}

NUMERIC_TYPES = {
    Question.QuestionType.STAR_RATING,
    Question.QuestionType.RATING_SCALE,
    Question.QuestionType.NPS,
}

STRUCTURAL_TYPES = {
    Question.QuestionType.SECTION_HEADING,
    Question.QuestionType.INSTRUCTIONAL_TEXT,
}


class AnalyticsService:
    def __init__(self, survey, raw_filters=None, *, include_insights=False):
        self.survey = survey if isinstance(survey, Survey) else Survey.objects.get(id=survey)
        self.raw_filters = raw_filters or {}
        self.include_insights = include_insights
        self.insights_service = AnalyticsTextInsightsService()

    def get_filtered_responses(self):
        queryset = (
            self.survey.responses.select_related("collector", "current_page")
            .prefetch_related(
                Prefetch(
                    "answers",
                    queryset=Answer.objects.select_related("question").prefetch_related(
                        Prefetch("question__choices", queryset=Choice.objects.order_by("order"))
                    ),
                )
            )
            .all()
        )
        return ResponseFilterService(queryset, self.raw_filters).apply()

    def get_summary(self):
        queryset = self.get_filtered_responses()
        total_responses = queryset.count()
        completed_count = queryset.filter(status=SurveyResponse.Status.COMPLETED).count()
        in_progress_count = queryset.filter(
            status=SurveyResponse.Status.IN_PROGRESS
        ).count()
        average_duration_seconds = (
            queryset.filter(duration_seconds__isnull=False).aggregate(
                value=Avg("duration_seconds")
            )["value"]
            or 0
        )

        responses_over_time = list(
            queryset.filter(completed_at__isnull=False)
            .annotate(bucket=TruncDate("completed_at"))
            .values("bucket")
            .annotate(count=Count("id"))
            .order_by("bucket")
        )

        data = {
            "total_responses": total_responses,
            "completed_count": completed_count,
            "in_progress_count": in_progress_count,
            "completion_rate": round(
                (completed_count / total_responses) * 100 if total_responses else 0,
                2,
            ),
            "average_duration_seconds": round(float(average_duration_seconds), 2),
            "responses_over_time": [
                {
                    "date": item["bucket"].isoformat() if item["bucket"] else None,
                    "count": item["count"],
                }
                for item in responses_over_time
            ],
        }
        return self._attach_insights("summary", data)

    def get_all_question_analytics(self):
        questions = (
            Question.objects.filter(page__survey=self.survey)
            .exclude(question_type__in=STRUCTURAL_TYPES)
            .prefetch_related("choices")
            .select_related("page")
        )
        return [
            self.get_question_analytics(question.id, question=question)
            for question in questions
        ]

    def get_question_analytics(self, question_id, *, question=None):
        question = question or self._get_question(question_id)
        responses = self.get_filtered_responses()
        answers = list(
            Answer.objects.filter(response__in=responses, question=question)
            .select_related("response")
            .order_by("-answered_at")
        )

        if question.question_type in CATEGORICAL_TYPES:
            data = self._categorical_analytics(question, answers)
        elif question.question_type in NUMERIC_TYPES:
            data = self._numeric_analytics(question, answers)
        elif question.question_type in {
            Question.QuestionType.SHORT_TEXT,
            Question.QuestionType.LONG_TEXT,
        }:
            data = self._text_analytics(answers)
        elif question.question_type == Question.QuestionType.MATRIX:
            data = self._matrix_analytics(question, answers)
        elif question.question_type == Question.QuestionType.RANKING:
            data = self._ranking_analytics(question, answers)
        elif question.question_type == Question.QuestionType.CONSTANT_SUM:
            data = self._constant_sum_analytics(question, answers)
        elif question.question_type == Question.QuestionType.DATE_TIME:
            data = self._date_time_analytics(question, answers)
        elif question.question_type == Question.QuestionType.DEMOGRAPHICS:
            data = self._demographics_analytics(question, answers)
        elif question.question_type == Question.QuestionType.FILE_UPLOAD:
            data = self._file_upload_analytics(answers)
        else:
            data = {
                "type": "unsupported",
                "total_responses": len(answers),
            }

        data.update(
            {
                "question": {
                    "id": str(question.id),
                    "text": question.text,
                    "type": question.question_type,
                }
            }
        )
        return self._attach_insights("question", data)

    def get_cross_tabulation(self, row_question_id, col_question_id):
        row_question = self._get_question(row_question_id)
        col_question = self._get_question(col_question_id)
        responses = self.get_filtered_responses()
        answer_map = self._build_response_answer_map(
            responses,
            [row_question.id, col_question.id],
        )

        contingency = defaultdict(lambda: defaultdict(int))
        response_pairs = 0

        for row_answer, col_answer in answer_map.values():
            if row_answer is None or col_answer is None:
                continue
            row_labels = self._labels_for_crosstab(row_question, row_answer)
            col_labels = self._labels_for_crosstab(col_question, col_answer)

            if not row_labels or not col_labels:
                continue

            for row_label in row_labels:
                for col_label in col_labels:
                    contingency[row_label][col_label] += 1
                    response_pairs += 1

        ordered_row_labels = list(contingency.keys())
        ordered_col_labels = list(
            {
                col_label
                for row_data in contingency.values()
                for col_label in row_data.keys()
            }
        )

        matrix = []
        col_totals = Counter()
        grand_total = 0

        for row_label in ordered_row_labels:
            row_total = sum(contingency[row_label].values())
            grand_total += row_total
            cells = []
            for col_label in ordered_col_labels:
                count = contingency[row_label].get(col_label, 0)
                col_totals[col_label] += count
                cells.append(
                    {
                        "col_label": col_label,
                        "count": count,
                        "percentage": round(
                            (count / row_total) * 100 if row_total else 0,
                            2,
                        ),
                    }
                )
            matrix.append(
                {
                    "row_label": row_label,
                    "cells": cells,
                    "row_total": row_total,
                }
            )

        chi_square = self._calculate_chi_square(
            [
                [contingency[row_label].get(col_label, 0) for col_label in ordered_col_labels]
                for row_label in ordered_row_labels
            ]
        )

        data = {
            "row_question": {
                "id": str(row_question.id),
                "text": row_question.text,
                "type": row_question.question_type,
            },
            "col_question": {
                "id": str(col_question.id),
                "text": col_question.text,
                "type": col_question.question_type,
            },
            "matrix": matrix,
            "col_totals": [
                {"col_label": col_label, "total": col_totals[col_label]}
                for col_label in ordered_col_labels
            ],
            "grand_total": grand_total,
            "response_pairs": response_pairs,
            "chi_square": chi_square,
        }
        return self._attach_insights("crosstab", data)

    def _get_question(self, question_id):
        return (
            Question.objects.filter(page__survey=self.survey, id=question_id)
            .prefetch_related("choices")
            .select_related("page")
            .get()
        )

    def _attach_insights(self, insight_type, data):
        if not self.include_insights:
            return data

        payload = dict(data)
        payload["insights"] = self.insights_service.build_insights(
            self.survey.title,
            insight_type,
            data,
        )
        return payload

    def _categorical_analytics(self, question, answers):
        total_responses = len(answers)
        counts = Counter()
        other_responses = []
        comments = []

        for answer in answers:
            for choice_id in answer.choice_ids or []:
                counts[str(choice_id)] += 1
            if answer.other_text.strip():
                other_responses.append(answer.other_text)
            if answer.comment_text.strip():
                comments.append(answer.comment_text)

        choices = [
            {
                "choice_id": str(choice.id),
                "text": choice.text,
                "count": counts.get(str(choice.id), 0),
                "percentage": round(
                    (counts.get(str(choice.id), 0) / total_responses) * 100
                    if total_responses
                    else 0,
                    2,
                ),
                "is_other": choice.is_other,
            }
            for choice in question.choices.all()
        ]
        return {
            "type": "categorical",
            "total_responses": total_responses,
            "choices": choices,
            "other_responses": other_responses,
            "comments": comments,
        }

    def _numeric_analytics(self, question, answers):
        values = [float(answer.numeric_value) for answer in answers if answer.numeric_value is not None]
        distribution_counter = Counter(values)
        total_responses = len(values)

        if values:
            try:
                mode_value = mode(values)
            except StatisticsError:
                mode_value = values[0]
        else:
            mode_value = None

        data = {
            "type": "numeric",
            "total_responses": total_responses,
            "mean": round(mean(values), 2) if values else None,
            "median": round(median(values), 2) if values else None,
            "mode": round(float(mode_value), 2) if mode_value is not None else None,
            "std_deviation": round(pstdev(values), 2) if len(values) > 1 else 0.0,
            "min": min(values) if values else None,
            "max": max(values) if values else None,
            "distribution": [
                {
                    "value": value,
                    "count": count,
                    "percentage": round((count / total_responses) * 100, 2)
                    if total_responses
                    else 0,
                }
                for value, count in sorted(distribution_counter.items())
            ],
        }

        if question.question_type == Question.QuestionType.NPS:
            promoters = sum(1 for value in values if value >= 9)
            passives = sum(1 for value in values if 7 <= value <= 8)
            detractors = sum(1 for value in values if value <= 6)
            data["nps_segments"] = {
                "promoters": promoters,
                "passives": passives,
                "detractors": detractors,
            }
            data["nps_score"] = (
                round(((promoters - detractors) / total_responses) * 100)
                if total_responses
                else 0
            )

        return data

    def _text_analytics(self, answers):
        text_answers = [answer for answer in answers if answer.text_value.strip()]
        words = Counter()
        total_word_count = 0

        for answer in text_answers:
            tokens = [
                token
                for token in re.findall(r"[A-Za-z0-9']+", answer.text_value.lower())
                if token not in STOP_WORDS
            ]
            words.update(tokens)
            total_word_count += len(tokens)

        return {
            "type": "text",
            "total_responses": len(text_answers),
            "responses": [
                {
                    "text": answer.text_value,
                    "responded_at": answer.answered_at.isoformat(),
                }
                for answer in text_answers
            ],
            "word_frequencies": [
                {"word": word, "count": count}
                for word, count in words.most_common(100)
            ],
            "avg_word_count": round(
                total_word_count / len(text_answers) if text_answers else 0,
                2,
            ),
        }

    def _matrix_analytics(self, question, answers):
        rows = question.settings.get("rows", [])
        columns = question.settings.get("columns", [])
        numeric_scores = self._numeric_column_map(columns)
        total_responses = len(answers)
        row_data = []
        row_averages = []

        for row_label in rows:
            counter = Counter()
            numeric_values = []
            for answer in answers:
                entry = (answer.matrix_data or {}).get(row_label)
                if isinstance(entry, dict):
                    for column_label, is_selected in entry.items():
                        if is_selected:
                            counter[column_label] += 1
                            if column_label in numeric_scores:
                                numeric_values.append(numeric_scores[column_label])
                elif entry:
                    counter[str(entry)] += 1
                    if str(entry) in numeric_scores:
                        numeric_values.append(numeric_scores[str(entry)])

            row_data.append(
                {
                    "row_label": row_label,
                    "columns": [
                        {
                            "col_label": column_label,
                            "count": counter.get(column_label, 0),
                            "percentage": round(
                                (counter.get(column_label, 0) / total_responses) * 100
                                if total_responses
                                else 0,
                                2,
                            ),
                        }
                        for column_label in columns
                    ],
                }
            )

            if numeric_values:
                row_averages.append(
                    {
                        "row_label": row_label,
                        "avg_score": round(mean(numeric_values), 2),
                    }
                )

        return {
            "type": "matrix",
            "total_responses": total_responses,
            "rows": row_data,
            "row_averages": row_averages,
        }

    def _ranking_analytics(self, question, answers):
        distributions = {str(choice.id): Counter() for choice in question.choices.all()}
        rank_totals = defaultdict(list)

        for answer in answers:
            for rank, choice_id in enumerate(answer.ranking_data or [], start=1):
                choice_key = str(choice_id)
                if choice_key in distributions:
                    distributions[choice_key][rank] += 1
                    rank_totals[choice_key].append(rank)

        return {
            "type": "ranking",
            "total_responses": len(answers),
            "items": [
                {
                    "choice_id": str(choice.id),
                    "text": choice.text,
                    "avg_rank": round(mean(rank_totals[str(choice.id)]), 2)
                    if rank_totals[str(choice.id)]
                    else None,
                    "rank_distribution": [
                        {"rank": rank, "count": count}
                        for rank, count in sorted(distributions[str(choice.id)].items())
                    ],
                }
                for choice in question.choices.all()
            ],
        }

    def _constant_sum_analytics(self, question, answers):
        totals = Counter()
        answered_count = len(answers)

        for answer in answers:
            for choice_id, raw_value in (answer.constant_sum_data or {}).items():
                try:
                    totals[str(choice_id)] += float(raw_value)
                except (TypeError, ValueError):
                    continue

        grand_total = sum(totals.values())
        return {
            "type": "constant_sum",
            "total_responses": answered_count,
            "items": [
                {
                    "choice_id": str(choice.id),
                    "text": choice.text,
                    "mean_value": round(
                        totals.get(str(choice.id), 0) / answered_count
                        if answered_count
                        else 0,
                        2,
                    ),
                    "total_value": round(totals.get(str(choice.id), 0), 2),
                    "percentage": round(
                        (totals.get(str(choice.id), 0) / grand_total) * 100
                        if grand_total
                        else 0,
                        2,
                    ),
                }
                for choice in question.choices.all()
            ],
        }

    def _date_time_analytics(self, question, answers):
        mode = question.settings.get("mode", "both")
        counter = Counter()

        if mode == "time":
            for answer in answers:
                if answer.text_value:
                    counter[answer.text_value] += 1
        else:
            dates = [answer.date_value for answer in answers if answer.date_value]
            if dates:
                span_days = max((max(dates) - min(dates)).days, 1)
                bucket_type = (
                    "day" if span_days <= 31 else "week" if span_days <= 180 else "month"
                )

                for date_value in dates:
                    if bucket_type == "day":
                        label = date_value.date().isoformat()
                    elif bucket_type == "week":
                        iso_year, iso_week, _ = date_value.isocalendar()
                        label = f"{iso_year}-W{iso_week:02d}"
                    else:
                        label = date_value.strftime("%Y-%m")
                    counter[label] += 1

        return {
            "type": "temporal",
            "total_responses": len(answers),
            "distribution": [
                {"date_bucket": label, "count": count}
                for label, count in sorted(counter.items())
            ],
        }

    def _demographics_analytics(self, question, answers):
        field_counter = defaultdict(Counter)
        field_totals = Counter()

        for answer in answers:
            for field_name, field_value in (answer.matrix_data or {}).items():
                value = f"{field_value}".strip()
                if not value:
                    continue
                field_counter[field_name][value] += 1
                field_totals[field_name] += 1

        return {
            "type": "demographics",
            "total_responses": len(answers),
            "fields": {
                field_name: [
                    {
                        "value": value,
                        "count": count,
                        "percentage": round(
                            (count / field_totals[field_name]) * 100
                            if field_totals[field_name]
                            else 0,
                            2,
                        ),
                    }
                    for value, count in counter.most_common()
                ]
                for field_name, counter in field_counter.items()
            },
        }

    def _file_upload_analytics(self, answers):
        files = []
        for answer in answers:
            if not answer.file_url:
                continue
            path = urlparse(answer.file_url).path or answer.file_url
            extension = os.path.splitext(path)[1].lstrip(".").lower() or "unknown"
            files.append(
                {
                    "file_url": answer.file_url,
                    "file_type": extension,
                    "answered_at": answer.answered_at.isoformat(),
                }
            )

        return {
            "type": "files",
            "total_responses": len(files),
            "files": files,
        }

    def _build_response_answer_map(self, responses, question_ids):
        answer_lookup = {response.id: [None] * len(question_ids) for response in responses}
        answers = Answer.objects.filter(
            response__in=responses,
            question_id__in=question_ids,
        )
        position_map = {str(question_id): index for index, question_id in enumerate(question_ids)}

        for answer in answers:
            response_answers = answer_lookup.get(answer.response_id)
            if response_answers is None:
                continue
            response_answers[position_map[str(answer.question_id)]] = answer

        return answer_lookup

    def _labels_for_crosstab(self, question, answer):
        if question.question_type in CATEGORICAL_TYPES:
            choice_map = {str(choice.id): choice.text for choice in question.choices.all()}
            labels = [
                choice_map.get(str(choice_id), str(choice_id))
                for choice_id in (answer.choice_ids or [])
            ]
            return labels

        if question.question_type == Question.QuestionType.NPS:
            if answer.numeric_value is None:
                return []
            value = float(answer.numeric_value)
            if value >= 9:
                return ["Promoter"]
            if value >= 7:
                return ["Passive"]
            return ["Detractor"]

        if question.question_type in {
            Question.QuestionType.RATING_SCALE,
            Question.QuestionType.STAR_RATING,
        }:
            if answer.numeric_value is None:
                return []
            value = float(answer.numeric_value)
            min_value = float(question.settings.get("min_value", 1))
            max_value = float(question.settings.get("max_value", 5))
            span = max(max_value - min_value, 1)
            low_threshold = min_value + span / 3
            high_threshold = min_value + (2 * span / 3)
            if value < low_threshold:
                return ["Low"]
            if value < high_threshold:
                return ["Medium"]
            return ["High"]

        if question.question_type in {
            Question.QuestionType.SHORT_TEXT,
            Question.QuestionType.LONG_TEXT,
        }:
            return [answer.text_value.strip()] if answer.text_value.strip() else []

        return []

    def _numeric_column_map(self, columns):
        numeric_scores = {}
        for column in columns:
            try:
                numeric_scores[str(column)] = float(column)
            except (TypeError, ValueError):
                continue
        return numeric_scores

    def _calculate_chi_square(self, table):
        if not table or not table[0]:
            return {
                "statistic": 0.0,
                "p_value": 1.0,
                "significant": False,
            }

        row_totals = [sum(row) for row in table]
        col_totals = [sum(table[row_index][col_index] for row_index in range(len(table))) for col_index in range(len(table[0]))]
        grand_total = sum(row_totals)

        if grand_total == 0:
            return {
                "statistic": 0.0,
                "p_value": 1.0,
                "significant": False,
            }

        statistic = 0.0
        for row_index, row in enumerate(table):
            for col_index, observed in enumerate(row):
                expected = (row_totals[row_index] * col_totals[col_index]) / grand_total
                if expected > 0:
                    statistic += ((observed - expected) ** 2) / expected

        degrees_of_freedom = max((len(table) - 1) * (len(table[0]) - 1), 1)
        p_value = self._chi_square_sf(statistic, degrees_of_freedom)

        return {
            "statistic": round(statistic, 4),
            "p_value": round(p_value, 6),
            "significant": p_value < 0.05,
        }

    def _chi_square_sf(self, statistic, degrees_of_freedom):
        return self._regularized_gamma_q(degrees_of_freedom / 2.0, statistic / 2.0)

    def _regularized_gamma_q(self, a, x):
        if x < 0 or a <= 0:
            return 1.0
        if x == 0:
            return 1.0
        if x < a + 1.0:
            return 1.0 - self._gamma_series(a, x)
        return self._gamma_continued_fraction(a, x)

    def _gamma_series(self, a, x):
        gln = math.lgamma(a)
        ap = a
        total = 1.0 / a
        delta = total

        for _ in range(1, 200):
            ap += 1.0
            delta *= x / ap
            total += delta
            if abs(delta) < abs(total) * 1e-14:
                break

        return total * math.exp(-x + a * math.log(x) - gln)

    def _gamma_continued_fraction(self, a, x):
        gln = math.lgamma(a)
        b = x + 1.0 - a
        c = 1.0 / 1e-300
        d = 1.0 / max(b, 1e-300)
        h = d

        for i in range(1, 200):
            an = -i * (i - a)
            b += 2.0
            d = an * d + b
            if abs(d) < 1e-300:
                d = 1e-300
            c = b + an / c
            if abs(c) < 1e-300:
                c = 1e-300
            d = 1.0 / d
            delta = d * c
            h *= delta
            if abs(delta - 1.0) < 1e-14:
                break

        return math.exp(-x + a * math.log(x) - gln) * h
