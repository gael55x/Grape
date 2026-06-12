class RefundPolicy
  def expedited_refund?(customer_tier)
    customer_tier == "vip"
  end
end
