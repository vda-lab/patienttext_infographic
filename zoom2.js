    // TODOS
    // doubles are removed

    const file = 3;

    const minRectWidth = 5,
        initDelay = 1000,
        initDuration = 2000;

    // set the dimensions and margins of the graph
    var margin = { top: 20, right: 60, bottom: 60, left: 160 },
        width = innerWidth - margin.left - margin.right,
        height = innerHeight - margin.top - margin.bottom;

    // append the svg object to the body of the page
    var Svg = d3.select("#dataviz_brushZoom")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    var tip = d3.tip()
        .attr("class", "d3-tip")
        .direction('n')
        .offset(function() {
            let thisX = this.getBBox().x;
            let thisWidth = this.getBBox().width;
            if (thisX + thisWidth > width) {
                return [0, -thisWidth / 2 + (width - thisX) / 2] // [top, left]
            } else if (thisX < 0) {
                return [0, (thisWidth / 2) - (thisX + thisWidth) / 2];
            } else {
                return [0, 0];
            }
        })
        .html(d => d.label);
    Svg.call(tip);

    //Read the data
    d3.xml("testset_annotated_ground_truth/" + file + ".xml").then(xml => {

        letterText = xml.querySelector("TEXT").textContent

        data = [].map.call(xml.querySelectorAll("EVENT"), function(event) {
            return {
                mostLikelyStart: new Date(event.getAttribute("most-likely-start")),
                mostLikelyEnd: new Date(event.getAttribute("most-likely-end")),
                lowerBoundStart: new Date(event.getAttribute("lowerbound-start")),
                lowerBoundEnd: new Date(event.getAttribute("lowerbound-end")),
                upperBoundStart: new Date(event.getAttribute("upperbound-start")),
                upperBoundEnd: new Date(event.getAttribute("upperbound-end")),
                label: event.getAttribute("text"),
                type: event.getAttribute("type")
            };
        });

        let admissionDate = new Date(letterText.split("\n")[2]);
        let dischargeDate = new Date(letterText.split("\n")[4]);


        data = _.unique(data, "label");
        data = data.reverse();

        minDate = _.min(data.map(d => d.lowerBoundStart));
        maxDate = _.max(data.map(d => d.upperBoundEnd));

        // Add X axis
        var x = d3.scaleTime()
            .domain([minDate, maxDate])
            .range([0, width]);
        var xAxis = Svg.append("g")
            // .attr("transform", "translate(0," + height + ")")
            .call(d3.axisTop(x));

        const verGridLines = d3.axisTop()
            .tickFormat("")
            .tickSize(-height)
            .scale(x);

        xAxis.append("g")
            .attr("class", "vergrid")
            .call(verGridLines);

        // Add Y axis
        var y = d3.scaleBand()
            .domain(data.map(d => d.label))
            .range([height, 0])
            .padding([0.2]);
        Svg.append("g")
            .call(d3.axisLeft(y));

        // Add a clipPath: everything out of this area won't be drawn.
        var clip = Svg.append("defs").append("svg:clipPath")
            .attr("id", "clip")
            .append("svg:rect")
            .attr("width", width)
            .attr("height", height)
            .attr("x", 0)
            .attr("y", 0);

        // Color scale: give me a specie name, I return a color
        var color = d3.scaleOrdinal()
            .domain(data.map(d => d.type))
            .range(d3.schemeCategory10)

        // Add brushing
        var brush = d3.brushX() // Add the brush feature using the d3.brush function
            .extent([
                [0, 0],
                [width, height]
            ]) // initialise the brush area: start at 0,0 and finishes at width,height: it means I select the whole graph area
            .on("end", updateChart) // Each time the brush selection changes, trigger the 'updateChart' function

        // Create the scatter variable: where both the circles and the brush take place
        var scatter = Svg.append('g')
            .attr("clip-path", "url(#clip)")

        // Add the brushing before the elements (for mouseover)
        scatter
            .append("g")
            .attr("class", "brush")
            .call(brush);

        scatter
            .selectAll(".mostlikely")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "mostlikely")
            .attr("width", d => Math.max(minRectWidth, x(d.mostLikelyEnd) - x(d.mostLikelyStart)))
            .attr("height", y.bandwidth())
            .attr("y", d => y(d.label))
            .attr("x", d => x(d.mostLikelyStart))
            .style("fill", d => color(d.type))
            .style("opacity", 0.8)
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);

        scatter
            .selectAll(".lower_uncertainty")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", d => "lower_uncertainty")
            .attr("width", d => x(d.mostLikelyStart) - x(d.lowerBoundStart))
            .attr("height", y.bandwidth())
            .attr("y", d => y(d.label))
            .attr("x", d => x(d.lowerBoundStart))
            .style("fill", d => color(d.type))
            .style("opacity", 0.1)
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);

        scatter
            .selectAll(".upper_uncertainty")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", d => "upper_uncertainty")
            .attr("width", d => x(d.upperBoundEnd) - x(d.mostLikelyEnd))
            .attr("height", y.bandwidth())
            .attr("y", d => y(d.label))
            .attr("x", d => x(d.mostLikelyEnd))
            .style("fill", d => color(d.type))
            .style("opacity", 0.1)
            // .attr("pointer-events", "visible")
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);

        minLikelyDate = _.min(data.map(d => d.mostLikelyStart));
        maxLikelyDate = _.max(data.map(d => d.mostLikelyEnd));
        updateChart(x(admissionDate), x(dischargeDate));

        // A function that set idleTimeOut to null
        var idleTimeout

        function idled() { idleTimeout = null; }

        // A function that update the chart for given boundaries
        function updateChart(startX, endX) {

            let duration = 1000;
            let delay = 0;

            if (startX) {
                extent = [startX, endX];
                duration = initDuration;
                delay = initDelay;
            } else {
                extent = d3.event.selection
            }

            // If no selection, back to initial coordinate. Otherwise, update X axis domain
            if (!extent) {
                if (!idleTimeout) return idleTimeout = setTimeout(idled, 350); // This allows to wait a little bit
                x.domain([minDate, maxDate]);
            } else {
                x.domain([x.invert(extent[0]), x.invert(extent[1])])
                scatter.select(".brush").call(brush.move, null) // This remove the grey brush area as soon as the selection has been done
            }

            // Update axis and circle position
            xAxis.transition().delay(delay).duration(duration).call(d3.axisTop(x))

            xAxis.append("g")
                .attr("class", "vergrid")
                .transition().delay(delay + 750).duration(duration)
                .call(verGridLines);

            scatter
                .selectAll(".mostlikely")
                .transition().delay(delay).duration(duration)
                .attr("width", d => Math.max(minRectWidth, x(d.mostLikelyEnd) - x(d.mostLikelyStart)))
                .attr("x", d => x(d.mostLikelyStart))

            scatter
                .selectAll(".lower_uncertainty")
                .transition().delay(delay).duration(duration)
                .attr("width", d => x(d.mostLikelyStart) - x(d.lowerBoundStart))
                .attr("x", d => x(d.lowerBoundStart))

            scatter
                .selectAll(".upper_uncertainty")
                .transition().delay(delay).duration(duration)
                .attr("width", d => x(d.upperBoundEnd) - x(d.mostLikelyEnd))
                .attr("x", d => x(d.mostLikelyEnd))

        }
    });