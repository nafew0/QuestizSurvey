import json
from dataclasses import dataclass
from datetime import datetime, time

from django.db.models import Q, QuerySet
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from surveys.models import Answer, SurveyResponse


@dataclass
class ParsedResponseFilters:
    date_from: datetime | None = None
    date_to: datetime | None = None
    collector_id: str | None = None
    status: str | None = None
    answer_filters: list | None = None
    duration_min_seconds: int | None = None
    duration_max_seconds: int | None = None
    text_search: str = ""


class ResponseFilterService:
    """Normalizes response filters for both analytics and response browsing."""

    def __init__(self, queryset: QuerySet, raw_filters=None):
        self.queryset = queryset
        self.raw_filters = raw_filters or {}
        self.filters = self.parse_filters(self.raw_filters)

    @classmethod
    def from_query_params(cls, queryset: QuerySet, query_params):
        parsed_filters = {}
        encoded_filters = query_params.get("filters")

        if encoded_filters:
            try:
                decoded = json.loads(encoded_filters)
                if isinstance(decoded, dict):
                    parsed_filters.update(decoded)
            except json.JSONDecodeError:
                pass

        direct_mappings = {
            "date_from": "date_from",
            "date_to": "date_to",
            "collector_id": "collector_id",
            "collector": "collector_id",
            "status": "status",
            "duration_min_seconds": "duration_min_seconds",
            "duration_max_seconds": "duration_max_seconds",
            "duration_gt": "duration_min_seconds",
            "duration_lt": "duration_max_seconds",
            "search": "text_search",
            "text_search": "text_search",
        }

        for query_key, filter_key in direct_mappings.items():
            value = query_params.get(query_key)
            if value not in (None, ""):
                parsed_filters[filter_key] = value

        question_id = query_params.get("q") or query_params.get("question_id")
        answer_value = query_params.get("answer")
        if question_id and answer_value:
            answer_filters = list(parsed_filters.get("answer_filters", []))
            answer_filters.append(
                {
                    "question_id": question_id,
                    "choice_id": answer_value,
                }
            )
            parsed_filters["answer_filters"] = answer_filters

        return cls(queryset, parsed_filters)

    @staticmethod
    def parse_filters(raw_filters) -> ParsedResponseFilters:
        filters = {}
        if hasattr(raw_filters, "getlist"):
            encoded_filters = raw_filters.get("filters")
            if encoded_filters:
                try:
                    decoded = json.loads(encoded_filters)
                    if isinstance(decoded, dict):
                        filters.update(decoded)
                except json.JSONDecodeError:
                    pass
            for key in [
                "date_from",
                "date_to",
                "collector_id",
                "collector",
                "status",
                "duration_min_seconds",
                "duration_max_seconds",
                "duration_gt",
                "duration_lt",
                "search",
                "text_search",
                "q",
                "question_id",
                "answer",
            ]:
                value = raw_filters.get(key)
                if value not in (None, ""):
                    filters[key] = value
        elif isinstance(raw_filters, dict):
            filters.update(raw_filters)
        elif hasattr(raw_filters, "get"):
            filters.update(raw_filters)

        if "collector_id" not in filters and filters.get("collector"):
            filters["collector_id"] = filters["collector"]
        if "duration_min_seconds" not in filters and filters.get("duration_gt"):
            filters["duration_min_seconds"] = filters["duration_gt"]
        if "duration_max_seconds" not in filters and filters.get("duration_lt"):
            filters["duration_max_seconds"] = filters["duration_lt"]
        if "text_search" not in filters and filters.get("search"):
            filters["text_search"] = filters["search"]

        if (filters.get("q") or filters.get("question_id")) and filters.get("answer"):
            filters["answer_filters"] = list(filters.get("answer_filters") or [])
            filters["answer_filters"].append(
                {
                    "question_id": filters.get("q") or filters.get("question_id"),
                    "choice_id": filters["answer"],
                }
            )

        answer_filters = filters.get("answer_filters")

        return ParsedResponseFilters(
            date_from=ResponseFilterService._parse_datetime(filters.get("date_from")),
            date_to=ResponseFilterService._parse_datetime(
                filters.get("date_to"),
                is_end=True,
            ),
            collector_id=(filters.get("collector_id") or "").strip() or None,
            status=(filters.get("status") or "").strip() or None,
            answer_filters=answer_filters if isinstance(answer_filters, list) else [],
            duration_min_seconds=ResponseFilterService._parse_int(
                filters.get("duration_min_seconds")
            ),
            duration_max_seconds=ResponseFilterService._parse_int(
                filters.get("duration_max_seconds")
            ),
            text_search=(filters.get("text_search") or "").strip(),
        )

    @staticmethod
    def _parse_int(value):
        if value in (None, ""):
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _parse_datetime(value, *, is_end=False):
        if not value:
            return None

        parsed = parse_datetime(value)
        if parsed is None:
            parsed_date = parse_date(value)
            if parsed_date is None:
                return None
            parsed = datetime.combine(
                parsed_date,
                time.max if is_end else time.min,
            )

        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())

        return parsed

    def apply(self):
        queryset = self.queryset

        if self.filters.status in dict(SurveyResponse.Status.choices):
            queryset = queryset.filter(status=self.filters.status)

        if self.filters.collector_id:
            queryset = queryset.filter(collector_id=self.filters.collector_id)

        if self.filters.date_from:
            queryset = queryset.filter(completed_at__gte=self.filters.date_from)

        if self.filters.date_to:
            queryset = queryset.filter(completed_at__lte=self.filters.date_to)

        if self.filters.duration_min_seconds is not None:
            queryset = queryset.filter(
                duration_seconds__gte=self.filters.duration_min_seconds
            )

        if self.filters.duration_max_seconds is not None:
            queryset = queryset.filter(
                duration_seconds__lte=self.filters.duration_max_seconds
            )

        if self.filters.text_search:
            queryset = queryset.filter(
                Q(respondent_email__icontains=self.filters.text_search)
                | Q(ip_address__icontains=self.filters.text_search)
                | Q(answers__text_value__icontains=self.filters.text_search)
                | Q(answers__other_text__icontains=self.filters.text_search)
            ).distinct()

        if self.filters.answer_filters:
            queryset = self._apply_answer_filters(queryset)

        return queryset

    def _apply_answer_filters(self, queryset):
        matching_ids = set(queryset.values_list("id", flat=True))

        for answer_filter in self.filters.answer_filters:
            question_id = (answer_filter.get("question_id") or "").strip()
            if not question_id:
                continue

            candidate_ids = set()
            answers = Answer.objects.filter(
                response_id__in=matching_ids,
                question_id=question_id,
            )

            choice_id = (answer_filter.get("choice_id") or "").strip()
            text_value = (answer_filter.get("text_value") or "").strip()
            contains_text = (answer_filter.get("contains") or "").strip()
            numeric_value = answer_filter.get("numeric_value")

            for answer in answers.iterator():
                if choice_id and choice_id not in (answer.choice_ids or []):
                    continue
                if text_value and answer.text_value != text_value:
                    continue
                if contains_text and contains_text.lower() not in (
                    f"{answer.text_value} {answer.other_text}".lower()
                ):
                    continue
                if numeric_value not in (None, "") and (
                    answer.numeric_value is None
                    or str(answer.numeric_value) != str(numeric_value)
                ):
                    continue

                candidate_ids.add(answer.response_id)

            matching_ids &= candidate_ids

        return queryset.filter(id__in=matching_ids)
