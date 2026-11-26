const list = document.querySelector('[data-test="project-list"]');
const count = document.querySelector('[data-test="project-count"]');

async function renderProjects() {
  const response = await fetch('/api/projects', { cache: 'no-store' });
  if (!response.ok) {
    list.textContent = 'Project data is unavailable.';
    return;
  }

  const payload = await response.json();
  list.replaceChildren();
  count.textContent = `${payload.total} records`;

  for (const project of payload.items) {
    const row = document.createElement('li');
    row.dataset.test = 'project-row';
    row.dataset.projectId = String(project.id);

    const left = document.createElement('div');
    const name = document.createElement('span');
    name.className = 'project-name';
    name.textContent = project.name;
    const owner = document.createElement('span');
    owner.className = 'project-owner';
    owner.textContent = `Owner: ${project.owner}`;
    left.append(name, owner);

    const status = document.createElement('span');
    status.className = `status ${project.status}`;
    status.dataset.test = 'project-status';
    status.textContent = project.status;

    row.append(left, status);
    list.append(row);
  }
}

renderProjects().catch(() => {
  list.textContent = 'Project data is unavailable.';
});
