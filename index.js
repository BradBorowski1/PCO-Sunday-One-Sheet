// Required libraries
import express from "express";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_TYPE_NAME = "Sunday Services";

// HTTP Basic Auth header
const authHeader = {
  headers: {
    Authorization:
      "Basic " +
      Buffer.from(
        `${process.env.PCO_CLIENT_ID}:${process.env.PCO_CLIENT_SECRET}`
      ).toString("base64"),
  },
};

async function getServiceTypeIdByName(name) {
  const res = await axios.get(
    "https://api.planningcenteronline.com/services/v2/service_types",
    authHeader
  );
  const service = res.data.data.find((i) => i.attributes.name === name);
  return service?.id;
}

async function getUpcomingPlan(id) {
  const res = await axios.get(
    `https://api.planningcenteronline.com/services/v2/service_types/${id}/plans`,
    authHeader
  );
  return res.data.data[0];
}

async function getTeams(planId) {
  const res = await axios.get(
    `https://api.planningcenteronline.com/services/v2/plans/${planId}/team_members?include=team,person,position`,
    authHeader
  );
  return res.data;
}

function formatTeams(data) {
  const inc = Object.fromEntries(data.included.map((i) => [i.id, i]));
  const grouped = {};

  for (const tm of data.data) {
    const team = inc[tm.relationships.team.data?.id]?.attributes.name;
    const pos = inc[tm.relationships.position.data?.id]?.attributes?.name;
    const person = inc[tm.relationships.person.data?.id]?.attributes;
    if (!team || !person) continue;

    const name = `${person.first_name} ${person.last_name.charAt(0)}.`;
    grouped[team] = grouped[team] || [];
    grouped[team].push({ name, position: pos || "Unspecified" });
  }

  return grouped;
}

app.get("/sunday-teams", async (req, res) => {
  try {
    const svcId = await getServiceTypeIdByName(SERVICE_TYPE_NAME);
    const plan = await getUpcomingPlan(svcId);
    const data = await getTeams(plan.id);
    const teams = formatTeams(data);

    let html = `
    <html><head>
      <meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Montserrat', sans-serif; background: #fff; color: #333; margin:0; padding:1rem; }
        h1 { font-weight:600; color: #222; margin-bottom:1rem; font-size:1.6rem; }
        .team { margin-bottom:2rem; }
        .team h2 { font-weight:400; border-bottom:2px solid #666; padding-bottom:0.25rem; margin-bottom:0.5rem; color:#444; }
        ul { list-style:none; padding:0; }
        li { margin:0.3rem 0; font-weight:300; }
        .position { font-weight:600; color:#555; }
      </style>
    </head><body>
      <h1>Sunday Teams – ${plan.attributes.dates}</h1>
    `;

    for (const [team, members] of Object.entries(teams)) {
      html += `<div class="team"><h2>${team}</h2><ul>`;
      members.forEach(m => {
        html += `<li><span>${m.name}</span> – <span class="position">${m.position}</span></li>`;
      });
      html += `</ul></div>`;
    }

    html += `</body></html>`;
    res.send(html);
  } catch (e) {
    console.error(e);
    res.status(500).send("Error fetching data.");
  }
});

app.listen(PORT, () => console.log(`Running on ${PORT}`));

