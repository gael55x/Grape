from dataclasses import dataclass


@dataclass(frozen=True)
class PriceRequest:
    subtotal: float
    tier: str
    member_discount: float = 0.15


def calculate_member_total(request: PriceRequest) -> float:
    if request.subtotal <= 0:
        return 0.0

    discount = request.member_discount if request.tier == "member" else 0.0
    return round(request.subtotal * (1 - discount), 2)
