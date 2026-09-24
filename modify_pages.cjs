const fs = require('fs');
let c = fs.readFileSync('e:/Agency/apps/web/src/ui/PublicPages.tsx', 'utf-8');
const lines = c.split('\n');
const oldStr = lines[6];
let newStr = oldStr.replace('{product.category}', '{product.category?.name || "Agent"}');
newStr = newStr.replace(
    "{product.releaseStatus === 'development' ? 'In development' : 'Preparing for launch'}",
    "{product.releaseStatus === 'development' ? 'In development' : product.releaseStatus === 'prelaunch' ? 'Preparing for launch' : 'Live'}"
);
newStr = newStr.replace(
    'View availability <ArrowUpRight',
    "{product.releaseStatus === 'live' ? 'Download now' : 'View availability'} <ArrowUpRight"
);
newStr = newStr.replace(
    '<h2>Built for your workflow.</h2>',
    "<h2>{product.workflowHeading || 'Built for your workflow.'}</h2>"
);
newStr = newStr.replace(
    '<p>{product.description}</p><div className="demo-placeholder"><Workflow size={40}/><h3>{product.name} walkthrough</h3><p>A product walkthrough will appear here.</p></div>',
    '<p>{product.workflowDescription || product.description}</p><div className="demo-placeholder" style={{ position: "relative", padding: 0, overflow: "hidden" }}>{product.workflowMediaUrl ? (product.workflowMediaUrl.match(/\\.(mp4|webm)$/i) ? <video src={product.workflowMediaUrl} autoPlay muted loop playsInline style={{ width: "100%", height: "auto", display: "block" }} /> : <img src={product.workflowMediaUrl} alt="Walkthrough" style={{ width: "100%", height: "auto", display: "block" }} />) : <><Workflow size={40}/><h3>{product.name} walkthrough</h3><p>A product walkthrough will appear here.</p></>}</div>{product.workflowNote && <p className="small-note" style={{ marginTop: "1rem" }}>{product.workflowNote}</p>}'
);
c = c.replace(oldStr, newStr);
fs.writeFileSync('e:/Agency/apps/web/src/ui/PublicPages.tsx', c);
console.log("Success");
