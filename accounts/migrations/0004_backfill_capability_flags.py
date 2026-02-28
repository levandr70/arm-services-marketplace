# Generated manually: backfill is_client/is_provider from role for existing users.

from django.db import migrations


def backfill_capability_flags(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(role__in=("provider", "admin")).update(is_provider=True)
    # is_client stays True for everyone (default); ensure admins can act as client
    User.objects.filter(role="admin").update(is_client=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_add_is_client_is_provider"),
    ]

    operations = [
        migrations.RunPython(backfill_capability_flags, noop_reverse),
    ]
