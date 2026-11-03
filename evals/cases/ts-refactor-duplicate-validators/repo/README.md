# accounts-validation

Validators for the three public forms of the accounts service (`src/validators.ts`) and the route handlers that use them (`src/routes.ts`).

| Form | Function | Fields |
|---|---|---|
| Signup | `validateSignup(input: SignupInput)` | `email`, `username`, `displayName` (optional), `password`, `phone` (optional), `company` (optional), `acceptTerms` |
| Profile update | `validateProfileUpdate(input: ProfileUpdateInput)` | `email`, `username`, `displayName`, `phone`, `company`, `bio`, all optional |
| Invite | `validateInvite(input: InviteInput)` | `email`, `role`, `message` (optional) |

Each validator takes the parsed form body and returns `{ ok: true }`, or `{ ok: false, errors }` where `errors` is a list of `{ field, message }`. There is at most one error per field (the first rule that fails), in the order the fields are listed above. Validators never change their input.

## Where the three differ (on purpose)

The mobile app and the support dashboard match on the exact messages and limits, so these differences are behavior, not accidents. Keep them.

- **Trimming.** Signup and invite trim the email before checking it. A profile update does not: a leading or trailing space is reported as an invalid address. Usernames and display names are trimmed in every form. Passwords and bios are never trimmed. An invite message is trimmed before its length is counted.
- **Email length.** 254 characters on signup and invite, 120 on a profile update (the width of the old profile table's column).
- **Wording.** The same rule can use different words. A blank email is "Email is required" when signing up or inviting and "Email cannot be empty" in a profile update. An invalid invite address says "Enter a valid email address for the invitee".
- **Usernames.** Signup accepts lowercase letters, digits and underscores. A profile update also accepts dots, because accounts imported from the old forum have them.
- **Optional fields.** In a profile update every field is optional and `undefined` means "leave it as it is", but a blank email, username or display name is an error. An empty bio is fine (it clears the bio). At signup the display name is optional too, and a blank one is ignored.
- **Phone and company.** Optional in signup and profile update, and checked the same way in both: trimmed, and a blank value is fine (ignored at signup, it clears the field in a profile update). A phone number is 7-20 characters of digits, spaces, parentheses and hyphens after an optional leading `+`; a company name is at most 60 characters.
