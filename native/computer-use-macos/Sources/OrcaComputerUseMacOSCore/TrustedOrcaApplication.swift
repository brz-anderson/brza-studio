/// Bundle ids of the apps whose computer-use sidecar may drive this helper.
public enum TrustedOrcaApplication {
    public static func isTrusted(bundleId: String) -> Bool {
        // Why: `pnpm dev` launches as `com.brzanderson.brzastudio.dev` and per-worktree wrapper apps use
        // `com.brzanderson.brzastudio.dev.<name>`; the sidecar peer check must authorize both (#26498).
        bundleId == "com.brzanderson.brzastudio" ||
            bundleId == "com.brzanderson.brzastudio.dev" ||
            bundleId.hasPrefix("com.brzanderson.brzastudio.dev.") ||
            bundleId == "com.github.Electron"
    }
}
