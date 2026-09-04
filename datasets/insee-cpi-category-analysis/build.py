"""Build CPI category analysis from the expanded INSEE snapshot."""

from datasets._shared.insee_cpi import build_category_analysis


def build(context):
    return build_category_analysis(context)
