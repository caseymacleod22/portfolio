import { Component } from '@angular/core';

interface Project {
  title: string;
  description: string;
  tags: string[];
  repoUrl?: string;
  liveUrl?: string;
}

@Component({
  imports: [],
  selector: 'app-projects',
  styleUrl: './projects.scss',
  templateUrl: './projects.html',
})
export class Projects {
  protected readonly projects: Project[] = [
    {
      title: 'Project One',
      description:
        'Replace with a short description of what this project does and the problem it solves.',
      tags: ['Angular', 'TypeScript'],
    },
    {
      title: 'Project Two',
      description:
        'Replace with a short description of what this project does and the problem it solves.',
      tags: ['Node.js', 'REST API'],
    },
    {
      title: 'Project Three',
      description:
        'Replace with a short description of what this project does and the problem it solves.',
      tags: ['CSS', 'Accessibility'],
    },
  ];
}
