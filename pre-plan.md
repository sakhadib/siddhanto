A simple Web app that uses openrouter, whose Key will be present on vercel secrets. for now present in .env.local as `OPENROUTER_API_KEY`.

The app will let users to type their state
then one or more questions. set type of questions as NOUL, SCORE, CHOISE

and let them put options. (as it requires by jev)

then when they hit enter / decide

it will be sent to jev and as the decision comes with probability, distribution, confidence etc, those will be shown in great visual representation


NO AUTH is required. a privacy page that clearly states that the data enters here will be recorded.

no access to agents, selenium / playright and take great measure against automation

mobile first UI design.

the state can be 1200 char long enforced strictly. and each question can be at max 512 char long. and a state can have at max 10 questions. 


As this is a data funnel public website, record every piece of data in already set firestore. 