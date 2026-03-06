from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    login_view,
    logout_view,
    get_user_view,
    UpdateProfileView,
    ChangePasswordView,
    delete_account_view,
)

app_name = "accounts"

urlpatterns = [
    # Authentication
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # User management
    path("user/", get_user_view, name="get_user"),
    path("user/update/", UpdateProfileView.as_view(), name="update_profile"),
    path("user/change-password/", ChangePasswordView.as_view(), name="change_password"),
    path("user/delete/", delete_account_view, name="delete_account"),
]
