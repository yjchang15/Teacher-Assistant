"use client";

export default function CourseSelector({
  date,
  subject,
  subjects,
}: {
  date: string;
  subject: string;
  subjects: { id: number; name: string }[];
}) {
  return (
    <form method="get" className="course-toolbar" onChange={(event) => event.currentTarget.requestSubmit()}>
      <div className="date-field">
        <label htmlFor="date">日期</label>
        <input id="date" type="date" name="date" className="form-control" defaultValue={date} />
      </div>
      <fieldset className="subject-field">
        <legend>科目</legend>
        <div className="subject-options">
          {subjects.map((item) => (
            <div key={item.id}>
              <input id={`subject-${item.id}`} type="radio" name="subject" value={item.name} defaultChecked={item.name === subject} />
              <label htmlFor={`subject-${item.id}`}><span>{item.name}</span><i className="bi bi-check-circle-fill" /></label>
            </div>
          ))}
        </div>
      </fieldset>
    </form>
  );
}
