{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 // Required libraries\
import express from "express";\
import axios from "axios";\
import dotenv from "dotenv";\
dotenv.config();\
\
const app = express();\
const PORT = process.env.PORT || 3000;\
\
const PCO_CLIENT_ID = process.env.PCO_CLIENT_ID;\
const PCO_CLIENT_SECRET = process.env.PCO_CLIENT_SECRET;\
const SERVICE_TYPE_NAME = "Sunday Services";\
\
// Encode credentials for Basic Auth\
const authHeader = \{\
  headers: \{\
    Authorization:\
      "Basic " +\
      Buffer.from(`$\{PCO_CLIENT_ID\}:$\{PCO_CLIENT_SECRET\}`).toString("base64"),\
  \},\
\};\
\
// Get Service Type ID by name\
async function getServiceTypeIdByName(name) \{\
  const res = await axios.get(\
    "https://api.planningcenteronline.com/services/v2/service_types",\
    authHeader\
  );\
  const serviceType = res.data.data.find(\
    (item) => item.attributes.name === name\
  );\
  return serviceType?.id;\
\}\
\
// Get upcoming plan for a service type\
async function getUpcomingPlan(serviceTypeId) \{\
  const res = await axios.get(\
    `https://api.planningcenteronline.com/services/v2/service_types/$\{serviceTypeId\}/plans`,\
    authHeader\
  );\
  return res.data.data[0]; // most recent upcoming plan\
\}\
\
// Get team members assigned to a plan\
async function getTeamsForPlan(planId) \{\
  const res = await axios.get(\
    `https://api.planningcenteronline.com/services/v2/plans/$\{planId\}/team_members?include=team,person,position`,\
    authHeader\
  );\
  return res.data;\
\}\
\
// Group and format the team data\
function formatTeamData(data) \{\
  const included = Object.fromEntries(\
    data.included.map((i) => [i.id, i])\
  );\
\
  const grouped = \{\};\
\
  for (const tm of data.data) \{\
    const team = included[tm.relationships.team.data?.id]?.attributes?.name;\
    const position = included[tm.relationships.position.data?.id]?.attributes?.name;\
    const person = included[tm.relationships.person.data?.id]?.attributes;\
    if (!team || !person) continue;\
\
    const name = `$\{person.first_name\} $\{person.last_name.charAt(0)\}.`;\
\
    if (!grouped[team]) grouped[team] = [];\
    grouped[team].push(\{\
      name: name,\
      position: position || "Unspecified Position",\
    \});\
  \}\
\
  return grouped;\
\}\
\
// Route to display team assignments\
app.get("/sunday-teams", async (req, res) => \{\
  try \{\
    const serviceTypeId = await getServiceTypeIdByName(SERVICE_TYPE_NAME);\
    const plan = await getUpcomingPlan(serviceTypeId);\
    const teamData = await getTeamsForPlan(plan.id);\
    const grouped = formatTeamData(teamData);\
\
    let html = `\
    <html>\
    <head>\
      <style>\
        body \{ font-family: sans-serif; padding: 20px; background: #f9f9f9; color: #333; \}\
        .team-section \{ margin-bottom: 2rem; \}\
        .team-section h2 \{ border-bottom: 2px solid #ccc; padding-bottom: 0.25rem; margin-bottom: 0.5rem; \}\
        ul \{ list-style-type: none; padding-left: 1rem; \}\
        li \{ padding: 4px 0; \}\
      </style>\
    </head>\
    <body>\
      <h1>Sunday Teams \'96 $\{plan.attributes.dates\}</h1>\
  `;\
\
    for (const [team, members] of Object.entries(grouped)) \{\
      html += `<div class="team-section"><h2>$\{team\}</h2><ul>`;\
      for (const m of members) \{\
        html += `<li>$\{m.name\} \'96 $\{m.position\}</li>`;\
      \}\
      html += `</ul></div>`;\
    \}\
\
    html += `</body></html>`;\
\
    res.send(html);\
  \} catch (err) \{\
    console.error(err);\
    res.status(500).send("Error fetching Sunday team assignments.");\
  \}\
\});\
\
app.listen(PORT, () => \{\
  console.log(`Server running on port $\{PORT\}`);\
\});\
}