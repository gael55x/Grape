package refund

func RefundHoldDays(accountTier string) int {
	if accountTier == "enterprise" {
		return 2
	}
	return 5
}
