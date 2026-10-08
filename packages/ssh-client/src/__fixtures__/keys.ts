// TEST-ONLY throwaway keys, generated with the real `ssh-keygen` so the tests
// prove Warden matches OpenSSH byte for byte. They open nothing. Never reuse.
//   ssh-keygen -t ed25519 -N ""       -C fixture@warden
//   ssh-keygen -t ed25519 -N "secret" -C locked@warden
export const PLAIN_PRIVATE = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nQyNTUxOQAAACC7xLrSjn2tgW1wLaGWn4g2MkOsn80nfWPAzdxvtWaYvQAAAJjC7M11wuzN\ndQAAAAtzc2gtZWQyNTUxOQAAACC7xLrSjn2tgW1wLaGWn4g2MkOsn80nfWPAzdxvtWaYvQ\nAAAED7DA5E5z0tZHqcvxNE0s4wAqOeZYW2IbZJZEz2u3iRDbvEutKOfa2BbXAtoZafiDYy\nQ6yfzSd9Y8DN3G+1Zpi9AAAADmZpeHR1cmVAd2FyZGVuAQIDBAUGBw==\n-----END OPENSSH PRIVATE KEY-----\n";
export const PLAIN_PUBLIC = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILvEutKOfa2BbXAtoZafiDYyQ6yfzSd9Y8DN3G+1Zpi9 fixture@warden";
/** exactly what `ssh-keygen -lf` printed */
export const PLAIN_FINGERPRINT = "SHA256:bAu1GTApNLDUV6PytRAXkzJDy2AgpqIXLXVmXD2IWDs";
export const LOCKED_PRIVATE = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABBghhjceg\nh94UFyKIuPlVWOAAAAGAAAAAEAAAAzAAAAC3NzaC1lZDI1NTE5AAAAIAFIWLn8oqUiprRQ\n+m39ndQ0HLe0ST5AWI34mchvPNgxAAAAkNtSKTVrGCcVByVj6xnmdPAjfSHHthZyVdHS49\nAkD3Gzph+6h9lUheAwaj/en7C9/uuUF2yZtl7qdjhYXMvguIfLolLNC7M3Cre7z2RWFXF7\nhDU4a2f3gpriurSDvzsSb7BssJzQ+7UJvnoAt3G7DHkHUH2mVSU8yJSlleAijH2nyRsusu\nJnHbadUfOays9JWw==\n-----END OPENSSH PRIVATE KEY-----\n";
