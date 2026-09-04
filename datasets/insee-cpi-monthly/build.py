"""Build the INSEE headline CPI dataset from its declared snapshot dependency."""

from datasets._shared.insee_cpi import build_monthly


def build(context):
    return build_monthly(context)
