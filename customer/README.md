# NTAXCO Customer Frontend

Independent customer portal for NTAXCO ERP. It uses the shared FastAPI + MongoDB backend.

## Local

```bash
corepack enable
yarn install
yarn start
```

Open http://localhost:3001.

Set `REACT_APP_API_URL` to the shared backend `/api` URL.

## Production

Set `REACT_APP_API_URL` in the hosting platform before `yarn build`, for example `https://YOUR-BACKEND-DOMAIN/api`.

## NTAXCO local startup

Run `yarn start` from this directory. The NTAXCO launcher binds the development
server to `127.0.0.1`, waits for the server to become ready, and opens:

`http://localhost:3001`

The previous Network URL is not required for normal local development.
