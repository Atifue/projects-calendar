const events = Array.isArray(window.__EVENTS__) ? window.__EVENTS__ : [];
const calendarRoot = document.getElementById("calendar");
const prevButton = document.getElementById("prevMonth");
const nextButton = document.getElementById("nextMonth");
const adminForms = document.querySelectorAll("[data-admin-action]");

adminForms.forEach((form) => {
  form.addEventListener("submit", (event) => {
    const input = form.querySelector('input[name="admin"]');
    if (!input || input.value) return;
    event.preventDefault();
    const token = window.prompt("Enter admin token");
    if (!token) return;
    input.value = token.trim();
    if (!input.value) return;
    form.submit();
  });
});

if (calendarRoot) {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let current = new Date();
  current.setDate(1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const eventsByDate = events.reduce((acc, event) => {
    if (!event.event_date) return acc;
    if (!acc[event.event_date]) {
      acc[event.event_date] = [];
    }
    acc[event.event_date].push(event);
    return acc;
  }, {});

  const render = () => {
    const today = new Date();
    const year = current.getFullYear();
    const month = current.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const label = `${monthNames[month]} ${year}`;

    const header = document.createElement("div");
    header.className = "calendar-header";
    header.innerHTML = `<span>${label}</span><span>${events.length} total plans</span>`;

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    weekDays.forEach((day) => {
      const cell = document.createElement("div");
      cell.className = "calendar-weekday";
      cell.textContent = day;
      grid.appendChild(cell);
    });

    for (let i = 0; i < startOffset; i += 1) {
      const empty = document.createElement("div");
      empty.className = "calendar-day";
      grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const cell = document.createElement("div");
      const cellDate = new Date(year, month, day);
      const iso = cellDate.toISOString().slice(0, 10);
      cell.className = "calendar-cell";
      if (isSameDay(cellDate, today)) {
        cell.classList.add("is-today");
      }
      cell.innerHTML = `<div class="calendar-date">${day}</div>`;

      const dayEvents = eventsByDate[iso] || [];
      dayEvents.forEach((event) => {
        const link = document.createElement("a");
        link.href = `/events/${event.id}`;
        link.className = "calendar-event";
        link.textContent = event.title;
        cell.appendChild(link);
      });

      grid.appendChild(cell);
    }

    calendarRoot.innerHTML = "";
    calendarRoot.appendChild(header);
    calendarRoot.appendChild(grid);
  };

  prevButton?.addEventListener("click", () => {
    current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    render();
  });

  nextButton?.addEventListener("click", () => {
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    render();
  });

  render();
}
