CREATE TABLE cycles (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id bigint NOT NULL REFERENCES groups (id),
    cycle_number integer NOT NULL CHECK (cycle_number > 0),
    contribution_pence integer NOT NULL CHECK (contribution_pence > 0),
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'completed')),
    UNIQUE (group_id, cycle_number),
    UNIQUE (group_id, id)
);

CREATE TABLE rounds (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id bigint NOT NULL,
    cycle_id bigint NOT NULL,
    recipient_user_id bigint NOT NULL,
    payout_position integer NOT NULL CHECK (payout_position > 0),
    due_on date NOT NULL,
    FOREIGN KEY (group_id, cycle_id) REFERENCES cycles (group_id, id),
    FOREIGN KEY (group_id, recipient_user_id)
        REFERENCES memberships (group_id, user_id),
    UNIQUE (cycle_id, payout_position),
    UNIQUE (cycle_id, recipient_user_id),
    UNIQUE (group_id, id)
);