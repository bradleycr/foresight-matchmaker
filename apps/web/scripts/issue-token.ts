import { issueToken } from "../lib/auth/tokens"

const email = process.argv[2]
if (!email) {
  console.error("usage: issue-token <email> [profileId]")
  process.exit(1)
}
const profileId = process.argv[3]
console.log(issueToken(email, profileId))
