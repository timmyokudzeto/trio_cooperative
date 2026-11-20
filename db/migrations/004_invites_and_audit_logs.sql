CREATE TABLE invites (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id bigint NOT NULL,
    invited_by_user_id bigint NOT NULL,
    email text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    accepted_at timestamptz,
    accepted_by_user_id bigint REFERENCES users(id),

    FOREIGN KEY (group_id, invited_by_user_id)
        REFERENCES memberships (group_id, user_id),

    CHECK (expires_at > created_at),
    CHECK ((accepted_at IS NULL) = (accepted_by_user_id IS NULL))
);
CREATE TABLE audit_logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id bigint NOT NULL REFERENCES groups(id),
    actor_user_id bigint,
    action text NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (group_id, actor_user_id)
        REFERENCES memberships (group_id, user_id)
);