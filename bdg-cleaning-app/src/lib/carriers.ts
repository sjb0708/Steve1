// Carrier email-to-SMS gateway domains — shared between the server-side
// sender (lib/sms.ts) and the client-side "Carrier" picker (users page)
// so this list stays in one place. Kept import-free (no email/SMS SDKs)
// since client components need it.

export const CARRIER_GATEWAYS: Record<string, string> = {
  VERIZON: "vtext.com",
  ATT: "txt.att.net",
  TMOBILE: "tmomail.net",
  SPRINT: "messaging.sprintpcs.com",
  BOOST: "sms.myboostmobile.com",
  CRICKET: "sms.cricketwireless.net",
  METRO: "mymetropcs.com",
  USCELLULAR: "email.uscc.net",
  GOOGLEFI: "msg.fi.google.com",
  STRAIGHTTALK: "vtext.com",
}

export const CARRIER_OPTIONS = [
  { value: "", label: "Unknown — pick to enable free texts" },
  { value: "VERIZON", label: "Verizon" },
  { value: "ATT", label: "AT&T" },
  { value: "TMOBILE", label: "T-Mobile" },
  { value: "METRO", label: "Metro by T-Mobile" },
  { value: "BOOST", label: "Boost Mobile" },
  { value: "CRICKET", label: "Cricket Wireless" },
  { value: "STRAIGHTTALK", label: "Straight Talk" },
  { value: "USCELLULAR", label: "US Cellular" },
  { value: "GOOGLEFI", label: "Google Fi" },
  { value: "SPRINT", label: "Sprint (legacy account)" },
]
