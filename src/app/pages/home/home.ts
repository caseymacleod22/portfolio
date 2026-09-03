import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Skill {
  name: string;
}

@Component({
  imports: [RouterLink],
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {
  protected readonly skills: Skill[] = [
    { name: 'TypeScript' },
    { name: 'Angular' },
    { name: 'JavaScript' },
    { name: 'HTML & CSS' },
    { name: 'Node.js' },
    { name: 'Git' },
  ];
}
