from grape_polyglot.pricing import PriceRequest, calculate_member_total


def test_member_discount_applies_to_positive_subtotal():
    request = PriceRequest(subtotal=100.0, tier="member")

    assert calculate_member_total(request) == 85.0
