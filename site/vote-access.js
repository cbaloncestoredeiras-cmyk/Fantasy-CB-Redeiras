// Shared, read-only preview of the server-enforced 72-hour voting window.
// Coaches need a dedicated server-approved entitlement (not an admin role).
export function canVoteFixture(fixture,eligibleFixtureIds=[],coachVoter=false,now=Date.now()){
 const end=Date.parse(fixture?.ended_at||'');
 if(!Number.isFinite(end))return false;
 const canParticipate=Boolean(coachVoter)||eligibleFixtureIds.includes(fixture.id);
 return canParticipate&&now>=end&&now<end+72*60*60*1000;
}
