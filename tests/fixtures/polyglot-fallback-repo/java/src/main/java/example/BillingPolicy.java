package example;

public final class BillingPolicy {
  public int retryWindowMinutes() {
    return 15;
  }

  public boolean allowsManualReview(String channel) {
    return "support".equals(channel);
  }
}
