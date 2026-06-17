package com.xccdos.prolog.security;

import de.mkammerer.argon2.Argon2;
import de.mkammerer.argon2.Argon2Factory;
import org.springframework.stereotype.Component;

@Component
public class PasswordHasher {

    public String hash(String rawPassword) {
        Argon2 argon2 = Argon2Factory.create(Argon2Factory.Argon2Types.ARGON2id);
        try {
            return argon2.hash(3, 65536, 1, rawPassword.toCharArray());
        } finally {
            argon2.wipeArray(rawPassword.toCharArray());
        }
    }

    public boolean verify(String encodedPassword, String rawPassword) {
        Argon2 argon2 = Argon2Factory.create(Argon2Factory.Argon2Types.ARGON2id);
        try {
            return argon2.verify(encodedPassword, rawPassword.toCharArray());
        } finally {
            argon2.wipeArray(rawPassword.toCharArray());
        }
    }
}
