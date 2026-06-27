# fun.masoko.net

Колекция от подбрани български вицове — статичен сайт на **Jekyll**, хостван на GitHub Pages.

Възможности:
- ⚡ Мигновено търсене във всички вицове и категории (изцяло в браузъра, без сървър)
- 🌗 Светъл / тъмен режим според системните настройки + ръчен превключвател
- 🎲 Случаен виц
- 🏷️ Филтриране по категория

## Добавяне на нов виц

Създай нов `.md` файл в папката `_jokes/` и го качи (push) в `main`. GitHub го построява автоматично.

```markdown
---
layout: joke
title: "Заглавие на вица"
date: 2024-01-15 12:00:00
category: family        # family | others | adults | work | ivancho | school
category_name: "Семейни"
tags: []
---

Тялото на вица.
Нов ред = два интервала в края на реда.
```

| `category` | Показва се като |
|------------|-----------------|
| `family`   | Семейни |
| `others`   | Разни |
| `adults`   | За големи |
| `work`     | Работа |
| `ivancho`  | За Иванчо |
| `school`   | Училище |

## Локално стартиране

```bash
bundle install
bundle exec jekyll serve
# http://localhost:4000
```

## Структура

```
_jokes/            вицовете (по един .md файл на виц)
_layouts/          default.html, joke.html
_includes/         head.html
assets/css|js|images
index.html         начална страница (търсене, категории, случаен виц)
_config.yml        настройки на Jekyll
```

Старите Pelican файлове (`content/`, `themes/`, `api/`, `web-add/`, `*.py`, `Makefile` …) са изключени от билда чрез `exclude:` в `_config.yml` и могат да се изтрият, когато прецениш.

Лиценз: GPLv3
