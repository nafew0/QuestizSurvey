from rest_framework import serializers

from surveys.models import Collector


class CollectorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collector
        fields = ["id", "survey", "type", "name", "status", "settings", "created_at"]
        read_only_fields = ["survey", "created_at"]
