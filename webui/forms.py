from django import forms
from django.contrib.auth import get_user_model

from marketplace.models import Category, City, CATEGORY_CHOICES, CITY_CHOICES, JobRequest

User = get_user_model()


class RegisterForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, min_length=8, label="Password")

    class Meta:
        model = User
        fields = ("email", "full_name", "phone", "city", "role")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["role"].choices = [
            (User.Role.CLIENT, "Client"),
            (User.Role.PROVIDER, "Provider"),
        ]
        self.fields["city"].widget = forms.Select(choices=CITY_CHOICES)
        self.fields["city"].required = False

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password"])
        if commit:
            user.save()
        return user


class LoginForm(forms.Form):
    email = forms.EmailField(label="Email")
    password = forms.CharField(widget=forms.PasswordInput, label="Password")


class CreateJobForm(forms.ModelForm):
    class Meta:
        model = JobRequest
        fields = (
            "title",
            "description",
            "category",
            "city",
            "budget_min_amd",
            "budget_max_amd",
            "deadline_date",
            "visibility",
        )
        widgets = {
            "title": forms.TextInput(attrs={"placeholder": "e.g. Plumbing repair in Yerevan"}),
            "description": forms.Textarea(attrs={"rows": 4, "placeholder": "Describe the job..."}),
            "budget_min_amd": forms.NumberInput(attrs={"placeholder": "15000", "min": 0}),
            "budget_max_amd": forms.NumberInput(attrs={"placeholder": "40000", "min": 0}),
            "visibility": forms.Select(choices=[
                (JobRequest.Visibility.PUBLIC, "Public"),
                (JobRequest.Visibility.VERIFIED_ONLY, "Verified only"),
            ]),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["category"].queryset = Category.objects.order_by("sort_order", "name")
        self.fields["category"].required = False
        self.fields["city"].queryset = City.objects.order_by("sort_order", "name")
        self.fields["city"].required = False
        self.fields["visibility"].choices = [
            (JobRequest.Visibility.PUBLIC, "Public"),
            (JobRequest.Visibility.VERIFIED_ONLY, "Verified only"),
        ]
        # Accept ISO (YYYY-MM-DD) and European (DD.MM.YYYY, DD/MM/YYYY) date formats
        self.fields["deadline_date"].input_formats = [
            "%Y-%m-%d",
            "%d.%m.%Y",
            "%d/%m/%Y",
            "%d-%m-%Y",
        ]
        self.fields["deadline_date"].required = False


class RespondForm(forms.Form):
    cover_message = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 4, "placeholder": "Introduce yourself and your approach..."}),
        required=False,
        label="Cover message",
    )
    proposed_price_amd = forms.IntegerField(
        required=False,
        min_value=0,
        label="Proposed price (AMD)",
        widget=forms.NumberInput(attrs={"placeholder": "e.g. 25000"}),
    )
    timeline_text = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 3, "placeholder": "e.g. 3-5 business days"}),
        required=False,
        label="Timeline",
    )
