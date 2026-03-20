from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from surveys.models import AIChatMessage, AIChatSession
from surveys.serializers import (
    AIChatMessageCreateSerializer,
    AIChatMessageSerializer,
    AIChatSessionDetailSerializer,
    AIChatSessionSerializer,
    AISummaryRequestSerializer,
)
from surveys.services import AIServiceConfigurationError, AIServiceRequestError
from surveys.services.ai_chat_service import AIChatService

from .common import get_owned_survey


class AISummaryThrottle(SimpleRateThrottle):
    scope = "survey_ai_summary"
    rate = "10/min"

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {
            "scope": self.scope,
            "ident": request.user.pk,
        }


class AIChatMessageThrottle(SimpleRateThrottle):
    scope = "survey_ai_chat"
    rate = "10/min"

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {
            "scope": self.scope,
            "ident": request.user.pk,
        }


class SurveyAIBaseView(APIView):
    permission_classes = [IsAuthenticated]

    def get_survey(self):
        return get_owned_survey(self.request.user, self.kwargs["survey_pk"])

    def get_chat_service(self, *, raw_filters=None):
        return AIChatService(
            self.get_survey(),
            self.request.user,
            raw_filters=raw_filters or {},
        )

    def get_session(self):
        return get_object_or_404(
            AIChatSession,
            id=self.kwargs["session_pk"],
            survey=self.get_survey(),
            user=self.request.user,
        )


class SurveyAISummaryView(SurveyAIBaseView):
    throttle_classes = [AISummaryThrottle]

    def post(self, request, survey_pk):
        serializer = AISummaryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            data = self.get_chat_service(
                raw_filters=serializer.validated_data.get("filters", {})
            ).build_summary()
        except AIServiceConfigurationError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AIServiceRequestError as exc:
            detail = str(exc)
            response_status = (
                status.HTTP_400_BAD_REQUEST
                if "No responses are available" in detail
                else status.HTTP_502_BAD_GATEWAY
            )
            return Response({"detail": detail}, status=response_status)

        return Response(data, status=status.HTTP_200_OK)


class SurveyAIChatSessionListCreateView(SurveyAIBaseView):
    def get(self, request, survey_pk):
        sessions = (
            AIChatSession.objects.filter(survey=self.get_survey(), user=request.user)
            .prefetch_related(
                Prefetch(
                    "messages",
                    queryset=AIChatMessage.objects.order_by("-created_at"),
                )
            )
            .order_by("-updated_at")
        )
        serializer = AIChatSessionSerializer(sessions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, survey_pk):
        session = self.get_chat_service().create_session()
        serializer = AIChatSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SurveyAIChatSessionDetailView(SurveyAIBaseView):
    def get(self, request, survey_pk, session_pk):
        survey = self.get_survey()
        session = get_object_or_404(
            AIChatSession.objects.prefetch_related("messages"),
            id=session_pk,
            survey=survey,
            user=request.user,
        )
        serializer = AIChatSessionDetailSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, survey_pk, session_pk):
        session = self.get_session()
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SurveyAIChatMessageCreateView(SurveyAIBaseView):
    throttle_classes = [AIChatMessageThrottle]

    def post(self, request, survey_pk, session_pk):
        serializer = AIChatMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            _user_message, assistant_message = self.get_chat_service(
                raw_filters=serializer.validated_data.get("filters", {})
            ).chat(self.get_session(), serializer.validated_data["message"])
        except AIServiceConfigurationError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AIServiceRequestError as exc:
            detail = str(exc)
            response_status = (
                status.HTTP_400_BAD_REQUEST
                if "No responses are available" in detail
                or "Enter a message before sending." in detail
                else status.HTTP_502_BAD_GATEWAY
            )
            return Response({"detail": detail}, status=response_status)

        response_serializer = AIChatMessageSerializer(assistant_message)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
