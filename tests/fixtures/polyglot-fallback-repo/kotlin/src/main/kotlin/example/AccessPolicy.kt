package example

class AccessPolicy {
  fun requiresReview(role: String): Boolean {
    return role == "contractor"
  }
}
