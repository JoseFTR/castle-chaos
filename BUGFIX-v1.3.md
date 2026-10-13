# Castle Chaos v1.3 — Boulder Panic and Audio Controls

- Boulder Panic now sends score updates every 500 ms instead of every 80 ms, preventing legitimate gameplay from hitting the server's 120-messages-per-10-seconds disconnect limit.
- Boulder collisions apply a time-based score penalty without sending lower scores, which the security v1.1 server rejects.
- Pointer down works for moving the ninja on touch screens.
- Audio sliders now show numeric percentages and use stable native range controls for mouse/touch.
- All existing server code, rooms, mini-game rotation, security rules, and visual theme are preserved.

To deploy: upload the **contents** of this folder to the root of the existing GitHub repository, keeping the `public/` folder structure. Commit, then confirm the v1.3 commit is live in Render. Existing active games may disconnect during deployment.
