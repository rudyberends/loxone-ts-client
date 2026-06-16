# Loxone protocol reference

Plain-text extracts of Loxone's official protocol documentation, kept here as the
reference this library is implemented against. They are the source material for
the design of the [`src/`](../../src) modules (transport framing, the auth
handshake, event tables, and the structure file).

| File | Source document | Version |
| --- | --- | --- |
| [communicating-with-the-miniserver.txt](communicating-with-the-miniserver.txt) | *Communicating with the Loxone Miniserver* | V17.0 (31.3.2026) |
| [structure-file.txt](structure-file.txt) | *Structure File (LoxAPP3.json)* | V17.0 |

These are text extractions of the original PDFs published by Loxone:

- https://www.loxone.com/enen/wp-content/uploads/sites/3/2026/04/1700_Communicating-with-the-Miniserver.pdf
- https://www.loxone.com/enen/wp-content/uploads/sites/3/2026/04/1700_Structure-File.pdf

> The documentation content is © Loxone Electronics GmbH and is included here only
> as an implementation reference. Refer to the original PDFs above for the
> authoritative and most up-to-date specification.

## Quick map into the code

| Topic in the docs | Implemented in |
| --- | --- |
| Connection, keepalive, error/close codes | [`transport/WebSocketConnection.ts`](../../src/transport/WebSocketConnection.ts) |
| `apiKey` reachability, certificate fetch | [`transport/HttpClient.ts`](../../src/transport/HttpClient.ts) |
| CloudDNS / Remote Connect | [`transport/CloudDns.ts`](../../src/transport/CloudDns.ts) |
| Tokens / JWT, hashing | [`auth/TokenManager.ts`](../../src/auth/TokenManager.ts), [`auth/hashing.ts`](../../src/auth/hashing.ts) |
| Command encryption (RSA + AES) | [`auth/CommandEncryption.ts`](../../src/auth/CommandEncryption.ts) |
| Secured (visu-password) commands | [`auth/SecuredCommands.ts`](../../src/auth/SecuredCommands.ts) |
| Message header + event tables | [`protocol/messages/`](../../src/protocol/messages), [`protocol/events/`](../../src/protocol/events) |
| Structure file (`LoxAPP3.json`) | [`structure/`](../../src/structure) |
