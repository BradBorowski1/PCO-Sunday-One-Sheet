// Vercel-compatible serverless API handler using Personal Access Token (PAT)
import axios from "axios";

const PAT = process.env.PCO_PAT;
const SERVICE_TYPE_NAME = "Sunday Services";

const axiosAuth = axios.create({
  baseURL: "https://api.planningcenteronline.com/services/v2",
  headers: {
    Authorization: `Bearer ${PAT}`,
    "Content-Type": "application/json",
    "User-Agent": "LSChurch Sunday Widget"
  },
  validateStatus: function (status) {
    return status < 500; // Let us catch 401s
  }
});

async function getServiceTypeIdByName(name) {
  try {
    const res = await axiosAuth.get("/service_types");
    if (res.status === 401) {
      throw new Error("Unauthorized access — PAT may not have access to Services API");
    }
    const serviceType = res.data.data.find(
      (item) => item.attributes.name === name
    );
    return serviceType?.id;
  } catch (error) {
    console.error("Failed to fetch service types:", error.response?.data || error.message);
    throw error;
  }
}

async function getUpcomingPlan(serviceTypeId) {
  const res = await axiosAuth.get(`/service_types/${serviceTypeId}/plans`);
  const plans = res.data.data;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextSunday = new Date(today);
  nextSunday.setDate(
    today.getDay() === 0 ? today.getDate() : today.getDate() + (7 - today.getDay())
  );
  const nextSundayStr = nextSunday.toISOString().split("T")[0];

  const upcoming = plans.find((plan) => {
    const planDate = plan.attributes.sort_date.split("T")[0];
    return planDate === nextSundayStr;
  });

  return upcoming;
}

async function getTeamsForPlan(planId) {
  const res = await axiosAuth.get(`/plans/${planId}/team_members?include=team,person,position`);
  return res.data;
}

function formatTeamData(data) {
  const included = Object.fromEntries(data.included.map((i) => [i.id, i]));
  const grouped = {};

  for (const tm of data.data) {
    const team = included[tm.relationships.team.data?.id]?.attributes?.name;
    const position = included[tm.relationships.position.data?.id]?.attributes?.name;
    const person = included[tm.relationships.person.data?.id]?.attributes;
    if (!team || !person) continue;

    const name = `${person.first_name} ${person.last_name.charAt(0)}.`;

    if (!grouped[team]) grouped[team] = [];
    grouped[team].push({ name, position: position || "Unspecified Position" });
  }

  return grouped;
}

export default async function handler(req, res) {
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const serviceTypeId = await getServiceTypeIdByName(SERVICE_TYPE_NAME);
    const plan = await getUpcomingPlan(serviceTypeId);

    if (!plan) {
      res.status(200).send("<html><body><h2>No plan found for the upcoming Sunday.</h2></body></html>");
      return;
    }

    const teamData = await getTeamsForPlan(plan.id);
    const grouped = formatTeamData(teamData);

    let html = `
    <html>
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Montserrat', sans-serif; padding: 20px; background: #ffffff; color: #333; }
        .team-section { margin-bottom: 2rem; }
        .team-section h2 { border-bottom: 2px solid #ccc; padding-bottom: 0.25rem; margin-bottom: 0.5rem; color: #222; }
        ul { list-style-type: none; padding-left: 1rem; }
        li { padding: 4px 0; }
      </style>
    </head>
    <body>
      <h1>Sunday Teams – ${plan.attributes.dates}</h1>
    `;

    for (const [team, members] of Object.entries(grouped)) {
      html += `<div class="team-section"><h2>${team}</h2><ul>`;
      for (const m of members) {
        html += `<li>${m.name} – ${m.position}</li>`;
      }
      html += `</ul></div>`;
    }

    html += `</body></html>`;
    res.status(200).send(html);
  } catch (err) {
    console.error("Final error handler:", err.response?.data || err.message);
    res.status(500).send(`<pre>${err.message || "Unknown error"}</pre>`);
  }
}
