.PHONY: build serve clean schemas js changelog examples

# Build the site
build: schemas changelog examples js
	bundle exec jekyll build

# Serve locally
serve: schemas changelog examples js
	bundle exec jekyll serve

# Build JavaScript assets
js:
	cd viewer && npm run build

# Clean generated files
clean:
	rm -rf _site _schemas/*.md _examples/*.md assets/viewer.js* assets/examples/ changelog.md examples.md viewer/node_modules node_modules

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

# Generate example pages
examples:
	@echo "Generating examples..."
	@mkdir -p _examples
	@mkdir -p assets/examples
	@mkdir -p assets/examples/previews

	# Build example stylesheets
	@for dir in examples/*/; do \
		if [ -f "$$dir/README.md" ]; then \
			example=$$(basename $$dir); \
			if [ -f "$$dir/style.js" ]; then \
				echo "Building stylesheet for $$example..."; \
				(cd examples && node build.js $$example) > assets/examples/$$example.json; \
			else \
				echo "Skipping $$example (no style.js found)"; \
			fi; \
		fi; \
	done

	# Generate preview images
	@for dir in examples/*/; do \
		if [ -f "$$dir/README.md" ] && [ -f "$$dir/style.js" ]; then \
			example=$$(basename $$dir); \
			echo "Generating preview for $$example..."; \
			center=$$(jq -r '.center // [15, 35] | @csv' assets/examples/$$example.json | tr -d '"'); \
			zoom=$$(jq -r '.zoom // 1' assets/examples/$$example.json); \
			npx mbgl-render assets/examples/$$example.json assets/examples/previews/$$example.png 400 300 -c $$center -z $$zoom -r 2; \
		fi; \
	done

	# Create examples gallery page
	@echo "---" > examples.md; \
	echo "layout: default" >> examples.md; \
	echo "title: Examples" >> examples.md; \
	echo "permalink: /examples/" >> examples.md; \
	echo "---" >> examples.md; \
	echo "" >> examples.md; \
	echo "<ul class=\"example-gallery\">" >> examples.md; \
	for dir in examples/*/; do \
		if [ -f "$$dir/README.md" ] && [ -f "$$dir/style.js" ]; then \
			example=$$(basename $$dir); \
			echo "  <li>" >> examples.md; \
			echo "    <a href=\"/examples/$$example/\">" >> examples.md; \
			echo "      <img src=\"/assets/examples/previews/$$example.png\" alt=\"$$example preview\">" >> examples.md; \
			echo "      <span>$$example</span>" >> examples.md; \
			echo "    </a>" >> examples.md; \
			echo "  </li>" >> examples.md; \
		fi; \
	done; \
	echo "</ul>" >> examples.md; \
	echo "Created examples gallery page"

	# Generate individual example pages
	@for dir in examples/*/; do \
		if [ -f "$$dir/README.md" ] && [ -f "$$dir/style.js" ]; then \
			example=$$(basename $$dir); \
			echo "Processing example $$example..."; \
			echo "---" > _examples/$$example.md; \
			echo "layout: example" >> _examples/$$example.md; \
			echo "title: $$example" >> _examples/$$example.md; \
			echo "permalink: /examples/$$example/" >> _examples/$$example.md; \
			echo "example_name: $$example" >> _examples/$$example.md; \
			echo "---" >> _examples/$$example.md; \
			echo "" >> _examples/$$example.md; \
			cat $$dir/README.md | sed '1{/^# /d;}' >> _examples/$$example.md; \
			echo "Created example page for $$example"; \
		fi; \
	done
