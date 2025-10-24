# judge-ai

**Time spent**: ~6-8 hours

**Extra features beyond spec**:
- Actual deployment
    - Deployed to judge-ai.nathancolosimo.com
    - because of this, I have extra parts of my app that wouldn't be present if I was just doing a demo.
- Backend
    - Since vite was required, I needed a backend so I decided on Hono + oRPC, and deployed that to vercel with the react app too. 
- Auth:
    - I implemented simple email + password sign in via better auth.
    - This lets me separate judges / submissions etc. by userID so other judges and questions aren't accessible by other people!
    - With more time + in a more B2B style app (this app probably would be) I would have implemented "Organizations" instead of just users, and then all users of that org would have access to that organizations resources. 
- A few charts + stats on the queue results page

**Tradeoffs:**
- **Accuracy vs. cost & time:**
    - I used smaller models to reduce cost and have faster evals, but accuracy is probably lower. 
    - Additionally, running each question + judge combination multiple times gets you a more accurate eval as you'll have more data. If you run a question 10 times instead of once you'll have a better idea of the models confidence. 
    - Simply having a "confidence" field isn't actually reliable, a better indicator would be seeing "oh this judge passes this answer on this question 9/10 times"
    - I just ran each question + judge once to save costs and time.
- **Client side vs server side on UI stuff:**
    - I did a lot of the sorting / graph calculations client side. This is faster to implement but less scalable, when you get to have thousands or potentially tens of thousands of evals eventually it won't be feasible to calculate stats client side, much more efficient to offload that to SQL, but that takes longer to develop.
- **Data model:**
    - I don't have a ton of different data models in DB, its not super finegrained. I just have submissions, questions, judges, question-judge assignments, and eval results. That's partly because the significance of each wasn't super clear, but also because that would take longer dev time. 
- **Synchronous batch runs vs background job / queue:**
    - Since I was using openrouter, and also because I am assuming the question set isn't that large (I run 10 question evals concurrently until I get through everything, with more credits in openrouter you can scale to much higher rate limits)
    - I just kick off a single endpoint / api call to run all the evals for a particular queue. 
    - If the set of evals got larger, where there was hundreds or thousands of evals to run, I would queue everything up in background jobs / processing to prevent running into function duration(if serverless) + memory limits. 
    - doing this synchronously saves dev time

## Stack

- **React Router** 
- **TailwindCSS**
- **shadcn/ui** - Reusable UI components
- **Hono** - Lightweight, performant server framework
- **oRPC** - End-to-end type-safe APIs
- **Node.js** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
npm install && npm run build
```
## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up. (Recommended: `supabase start` in judge-ai directory)
2. Add `apps/server/.env` and `apps/web/.env` for development. Copy .env.example and fill in the blanks:
3. Update your `apps/server/.env` file with your PostgreSQL connection details. 
4. Set BETTER_AUTH_SECRET - recommended `openssl rand -base64 32`
5. Set OPENROUTER_API_KEY - create an openrouter account if you don't already.

6. Apply the schema to your database:
```bash
npm run db:migrate
```


Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).







## Project Structure

```
judge-ai/
├── apps/
│   ├── web/         # Frontend application (React + React Router)
│   └── server/      # Backend API (Hono, ORPC)
├── packages/
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `npm run dev`: Start all applications in development mode
- `npm run build`: Build all applications
- `npm run db:migrate`: Migrate schema changes to database
- `npm run db:studio`: Open database studio UI
