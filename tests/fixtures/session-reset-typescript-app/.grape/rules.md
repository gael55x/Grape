# Session Reset Fixture Rules

- Always resend pinned safety context after a session reset.
- Never treat `OMIT_UNCHANGED` as proof that the agent still remembers prior context.
- A reset session must invalidate prior sent context before current context is resent.
