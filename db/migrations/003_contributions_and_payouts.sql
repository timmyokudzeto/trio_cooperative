CREATE TABLE contributions (
    group_id bigint NOT NULL,
    round_id bigint NOT NULL,
    member_user_id bigint NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (round_id, member_user_id),

    FOREIGN KEY (group_id, round_id)
        REFERENCES rounds (group_id, id),

    FOREIGN KEY (group_id, member_user_id)
        REFERENCES memberships (group_id, user_id)
);

CREATE TABLE payouts (
    round_id bigint PRIMARY KEY REFERENCES rounds (id),
    amount_pence bigint NOT NULL CHECK (amount_pence > 0),
    paid_at timestamptz NOT NULL DEFAULT now()
);