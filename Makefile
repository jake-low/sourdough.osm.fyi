.PHONY: build serve clean schemas js changelog

# Build the site
build: schemas changelog js
	bundle exec jekyll build

# Serve locally
serve: schemas changelog js
	bundle exec jekyll serve

# Build JavaScript assets
js:
	cd viewer && npm run build

# Clean generated files
clean:
	rm -rf _site _schemas/*.md assets/viewer.js* changelog.md viewer/node_modules

# Generate schema documentation files
schemas:
	@echo "Generating schema documentation..."
	@mkdir -p _schemas
	
	# Copy current version (HEAD)
	@if [ -f sourdough/SCHEMA.md ]; then \
		echo "---" > _schemas/current.md; \
		echo "layout: schema" >> _schemas/current.md; \
		echo "title: Schema Documentation" >> _schemas/current.md; \
		echo "permalink: /schema/" >> _schemas/current.md; \
		echo "version: current" >> _schemas/current.md; \
		echo "---" >> _schemas/current.md; \
		echo "" >> _schemas/current.md; \
		sed '1{/^# /d;}' sourdough/SCHEMA.md >> _schemas/current.md; \
		echo "Created schema documentation for current version"; \
	else \
		echo "Warning: sourdough/SCHEMA.md not found"; \
	fi
	
	# Generate versioned schemas from git tags
	@git -C sourdough tag -l 'v*' | sort -V | while read tag; do \
		echo "Processing tag $$tag..."; \
		if git -C sourdough show "$$tag:SCHEMA.md" > /dev/null 2>&1; then \
			echo "---" > _schemas/$$tag.md; \
			echo "layout: schema" >> _schemas/$$tag.md; \
			echo "title: Schema Documentation" >> _schemas/$$tag.md; \
			echo "permalink: /schema/$$tag/" >> _schemas/$$tag.md; \
			echo "version: $$tag" >> _schemas/$$tag.md; \
			echo "date: $$(git -C sourdough log -1 --format=%ci $$tag)" >> _schemas/$$tag.md; \
			echo "---" >> _schemas/$$tag.md; \
			echo "" >> _schemas/$$tag.md; \
			git -C sourdough show "$$tag:SCHEMA.md" | sed '1{/^# /d;}' >> _schemas/$$tag.md; \
			echo "Created schema documentation for $$tag"; \
		fi; \
	done

# Generate changelog page
changelog:
	@echo "Generating changelog..."
	@if [ -f sourdough/CHANGELOG.md ]; then \
		echo "---" > changelog.md; \
		echo "layout: default" >> changelog.md; \
		echo "title: Changelog" >> changelog.md; \
		echo "permalink: /changelog/" >> changelog.md; \
		echo "---" >> changelog.md; \
		echo "" >> changelog.md; \
		sed '1{/^# /d;}' sourdough/CHANGELOG.md >> changelog.md; \
		echo "Created changelog page"; \
	else \
		echo "Warning: sourdough/CHANGELOG.md not found"; \
	fi
