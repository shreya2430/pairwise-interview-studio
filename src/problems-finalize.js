// Gives every problem the multi-part shape: parts[i] = { title, body, tests, hidden }.
// p.tests and p.hidden become every part's tests, each tagged with its part index.
PROBLEMS.forEach(p => {
  if (!p.parts) p.parts = [{ title: p.title, body: '', tests: p.tests, hidden: p.hidden }];
  p.parts.forEach((pt, i) => { pt.tests.concat(pt.hidden).forEach(t => { t.part = i; }); });
  p.tests = [].concat.apply([], p.parts.map(pt => pt.tests));
  p.hidden = [].concat.apply([], p.parts.map(pt => pt.hidden));
});
