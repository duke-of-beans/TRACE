# TRACE Node Configuration Reference

## Overview

Every chapter runs the same TRACE software. The differences are what hardware you run it on,
which options you enable, and how much you invest in security and capability.

The **Node Settings** page in the operator console (sidebar > Node, or key 0) is the live,
interactive source of truth for your chapter's configuration. It shows current status, explains
every option in plain language, and links to detailed instructions.

## Option Categories

### 1. Hardware
- Your existing laptop ($0, on when open)
- Raspberry Pi ($75-120, always on, 5 watts)
- Repurposed old computer ($0-30, Linux)
- Mini PC ($150-400, local AI capable)
- Server hardware ($500-5000+, maximum capability)

### 2. Network Access
- Local network only (most secure, zero internet exposure)
- Tailscale (private mesh VPN, recommended for remote reporters)
- Cloudflare Tunnel (public URL, easiest for reporters)
- Tor onion service (maximum anonymity, slower)
- WiFi hotspot (enforcement events, no internet needed)

### 3. Security Hardening
- Database encryption: AES-256 via SQLCipher (always on, cannot be disabled)
- Full-disk encryption: LUKS/BitLocker/FileVault (recommended for all dedicated devices)
- Panic wipe: instant data destruction (last resort, requires backups)
- Duress passphrase: decoy database under coercion (consult security trainer)
- Zero-log mode: no application logs (high-threat periods only)
- Hardware security key: YubiKey/FIDO2 for identity signing

### 4. AI Engine
- No AI: fully manual operation, zero dependencies
- Cloud AI: Anthropic Claude API, best quality, data sanitized before sending
- Local AI (Ollama): 8B-70B models, zero data exfiltration, hardware dependent
- Hybrid: local for routine, cloud for complex with operator approval

### 5. Peer Sharing
- Manual .trace files: encrypted export, send via Signal/email/USB
- LoRa/Meshtastic: short text alerts between nearby chapters, no internet
- Automated sync: persistent bilateral connections (advanced)

### 6. Backup
- Encrypted USB export (weekly minimum)
- Encrypted cloud backup (automatic, any provider)
- Cross-chapter mutual aid (no cloud dependency)

## Recommended Configurations

**Just getting started**: Existing laptop + local network + defaults = $0, 5 minutes

**Reliable community node**: Raspberry Pi + Tailscale + cloud AI = ~$100 + $10-30/month

**Tech-forward chapter**: Mini PC + Tailscale + Tor + local AI + YubiKey = $300-600

**Maximum security**: Dedicated hardware + Tor only + local AI only + panic wipe = $200-500

## Full Reference

The complete reference with detailed requirements, costs, labor estimates, and security
implications for every option is available in the Node Settings > Setup Guide tab in the
operator console, and in the TRACE_NODE_CONFIG_MENU.md document.
