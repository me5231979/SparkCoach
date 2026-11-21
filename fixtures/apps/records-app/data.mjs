// FAKE personal data. The privacy suite asserts none of these strings ever leave the page.
export const SEEDED = {
  names: ["Avery Quinlan-Testperson", "Jordan Fakeworth"],
  ssns: ["900-12-3456", "900-65-4321"],
  salaries: ["$123,456.78", "$98,765.43"],
  emails: ["avery.quinlan@fixture.invalid", "jordan.fakeworth@fixture.invalid"],
  notes: ["Confidential note: relocating for family reasons"],
  typed: ["Morgan Typedname-Secret"], // what the e2e types into New Owner
  dates: ["2031-07-04"],
};
export const RECORDS = [
  { id: "48213", name: SEEDED.names[0], ssn: SEEDED.ssns[0], salary: SEEDED.salaries[0], email: SEEDED.emails[0], owner: "Pat Fixture", note: SEEDED.notes[0] },
  { id: "48214", name: SEEDED.names[1], ssn: SEEDED.ssns[1], salary: SEEDED.salaries[1], email: SEEDED.emails[1], owner: "Sam Fixture", note: "" },
];
