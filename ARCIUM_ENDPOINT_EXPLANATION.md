# ARCIUM_ENDPOINT Configuration Explanation

## Important: How Arcium Actually Works

**Arcium nodes do NOT expose HTTP REST APIs.** The Arcium MPC network works entirely through **Solana program calls**.

### Architecture

1. **Backend** → Calls Solana program instruction (e.g., `encrypt_bridge_amount`)
2. **Solana Program** → Queues MPC computation via `queue_computation()`
3. **Arcium Network** → Your Docker node participates in MPC execution (via Solana chain)
4. **Callback** → Result returned to Solana program account
5. **Backend** → Reads result from Solana account

### What ARCIUM_ENDPOINT Is For

The `ARCIUM_ENDPOINT` environment variable is:
- **Currently**: Informational/reference value stored in the service
- **Future**: May be used by Arcium SDK for direct node communication (if SDK adds this feature)
- **NOT used for**: Direct HTTP requests to the Docker node

### Docker Node Port (8080)

Your Docker node runs on port 8080, but this port is:
- Used internally by the Arcium node
- Not exposed as an HTTP API for your backend to call
- The node participates in MPC through Solana, not direct HTTP

## Configuration

Even though `ARCIUM_ENDPOINT` isn't used for direct connections, you should still set it correctly:

```env
ARCIUM_ENDPOINT=http://localhost:8080
```

This ensures:
- Configuration is accurate if SDK adds HTTP support later
- Logs show the correct endpoint
- Configuration validators can verify setup

## Verification

To verify your Docker node is working:

1. **Check Docker container**: `docker ps | grep arx-node` ✅
2. **Check Solana connection**: Backend connects to Solana ✅
3. **Verify node is active**: `arcium arx-active <offset> --rpc-url <rpc-url>`
4. **Test MPC operations**: Use backend API endpoints

## Summary

- ✅ Docker node running on port 8080
- ✅ Backend connects via Solana (not direct HTTP)
- ✅ `ARCIUM_ENDPOINT` is informational/future use
- ✅ Set it to `http://localhost:8080` for accuracy

The important thing is that:
- Your Docker node is running ✅
- Solana connection works ✅
- `FLASH_BRIDGE_MXE_PROGRAM_ID` is set ✅

Once these are configured, MPC operations will work through Solana program calls!

