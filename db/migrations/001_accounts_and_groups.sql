-- Create the table that stores one row per Trio account.
CREATE TABLE users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- PostgreSQL generates a unique whole-number ID.
    email text NOT NULL,                                -- Every account must have an email.
    display_name text NOT NULL,                         -- Every account must have a display name.
    created_at timestamptz NOT NULL DEFAULT now()       -- Defaults to the current time when you add the account.
);

-- Require each email to be unique after trimming spaces and converting to lowercase.
-- For example, ' Alex@example.com ' and 'alex@example.com' count as the same email.
CREATE UNIQUE INDEX users_email_unique
    ON users (lower(btrim(email)));

-- Create the table that stores one row per savings circle.
CREATE TABLE groups (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- PostgreSQL generates a unique ID for the circle.
    name text NOT NULL CHECK (btrim(name) <> ''),         -- The name is required and can't be empty or all spaces.
    created_at timestamptz NOT NULL DEFAULT now()        -- Defaults to the current time when you create the circle.
);

-- Create the table that links users to the circles they belong to.
CREATE TABLE memberships (
    group_id bigint NOT NULL REFERENCES groups(id),    -- Must match the ID of an existing circle.
    user_id bigint NOT NULL REFERENCES users(id),       -- Must match the ID of an existing user.
    role text NOT NULL DEFAULT 'member'                 -- If you leave out the role, it defaults to 'member'.
        CHECK (role IN ('admin', 'member')),            -- PostgreSQL accepts only these two roles.
    joined_at timestamptz NOT NULL DEFAULT now(),       -- Defaults to the current time when you add the membership.
    left_at timestamptz,                               -- NULL means they still belong. A timestamp records when they left.
    PRIMARY KEY (group_id, user_id)                     -- Each user can have only one membership row per circle.
);