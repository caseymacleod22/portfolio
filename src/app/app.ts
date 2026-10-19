import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './shared/header/header';
import { Footer } from './shared/footer/footer';
import { CtaBanner } from './shared/cta-banner/cta-banner';
import { ShapeField } from './shared/shape-field/shape-field';

@Component({
  imports: [RouterOutlet, Header, CtaBanner, Footer, ShapeField],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
