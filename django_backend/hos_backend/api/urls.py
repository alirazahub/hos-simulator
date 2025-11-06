from django.urls import path
from .views import process_data

urlpatterns = [
    path('process/', process_data, name='process-data'),
]
