from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

@api_view(['POST'])
def process_data(request):
    name = request.data.get('name')
    age = request.data.get('age')

    if not name or age is None:
        return Response(
            {"error": "Both 'name' (string) and 'age' (integer) are required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        age = int(age)
    except ValueError:
        return Response({"error": "'age' must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

    result = {
        "message": f"Hello {name}, you are {age} years old!"
    }
    return Response(result, status=status.HTTP_200_OK)
